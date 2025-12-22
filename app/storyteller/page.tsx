/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import StorytellerClient from "./StorytellerClient";
import { unstable_cache } from "next/cache";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const STORYTELLER_DB_ID = process.env.NOTION_STORYTELLER_DB_ID;
const API_BASE_URL =
  "https://mashboard-api.despreadlabs.io/storyteller-leaderboard";

const LOOKBACK_DAYS = [7, 14, 30, 90];

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2025-09-03",
};

// ----------------------------------------------------------------------
// 1. 노션 데이터 가져오기
// ----------------------------------------------------------------------
async function fetchNotionTasksRaw() {
  if (!NOTION_TOKEN || !STORYTELLER_DB_ID) return [];

  try {
    // [Step 1] DB 메타데이터 조회
    const dbRes = await fetch(
      `https://api.notion.com/v1/databases/${STORYTELLER_DB_ID}`,
      { headers, next: { revalidate: 0 } }
    );
    if (!dbRes.ok) return [];

    const dbData = await dbRes.json();
    const dataSources = dbData.data_sources || [];
    const allResults: any[] = [];

    // [Step 2] 데이터 조회
    if (dataSources.length === 0) {
      const legacyRes = await fetch(
        `https://api.notion.com/v1/databases/${STORYTELLER_DB_ID}/query`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ page_size: 100 }),
          next: { revalidate: 0 },
        }
      );
      if (legacyRes.ok)
        allResults.push(...((await legacyRes.json()).results || []));
    } else {
      await Promise.all(
        dataSources.map(async (source: any) => {
          const queryRes = await fetch(
            `https://api.notion.com/v1/data_sources/${source.id}/query`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({ page_size: 100 }),
              next: { revalidate: 0 },
            }
          );
          if (queryRes.ok)
            allResults.push(...((await queryRes.json()).results || []));
        })
      );
    }

    // [Step 3] 데이터 매핑
    const tasks = allResults.map((page: any) => {
      const props = page.properties || {};

      // 제목 ("프로젝트" 속성 우선)
      const titleProp =
        props["프로젝트"] ||
        props["이름"] ||
        props["Name"] ||
        props["Title"] ||
        props["제목"];
      const title = titleProp?.title?.[0]?.plain_text || "Untitled";

      // GroupID 추출
      const groupProp =
        props["GroupID"] || props["Group ID"] || props["그룹ID"];
      let groupId: string | null = null;
      if (groupProp?.type === "number")
        groupId = groupProp.number?.toString() || null;
      else if (groupProp?.type === "rich_text")
        groupId = groupProp.rich_text?.[0]?.plain_text || null;
      else if (groupProp?.type === "select")
        groupId = groupProp.select?.name || null;

      // 날짜 처리
      const dateProp =
        props["날짜"] || props["Date"] || props["Period"] || props["일정"];
      let dateStart: string | null = null;
      let dateEnd: string | null = null;

      if (dateProp?.type === "date" && dateProp.date) {
        dateStart = dateProp.date.start;
        dateEnd = dateProp.date.end || dateStart;
      } else if (dateProp?.type === "rich_text" || dateProp?.type === "title") {
        const textContent =
          dateProp.rich_text?.[0]?.plain_text ||
          dateProp.title?.[0]?.plain_text ||
          "";
        const parsed = parseKoreanDate(textContent);
        dateStart = parsed.start;
        dateEnd = parsed.end;
      }

      // 상태 및 기타 속성
      const statusProp = props["상태"] || props["Status"] || props["State"];
      const categoryProp = props["분류"] || props["Category"];
      const personProp = props["담당자"] || props["Person"];

      return {
        id: page.id,
        title,
        groupId, // string | null
        dateStart,
        dateEnd,
        status: statusProp?.status?.name || statusProp?.select?.name || "Ready",
        category:
          categoryProp?.select?.name ||
          categoryProp?.multi_select?.[0]?.name ||
          "General",
        manager: personProp?.people?.[0]?.name || "-",
        managerImg: personProp?.people?.[0]?.avatar_url || null,
      };
    });

    // [Filter Modified] GroupID가 있는 프로젝트만 필터링 (상태 무관)
    // - 기존: "진행중" 상태만 필터링
    // - 변경: GroupID가 존재하면 모두 반환 (타임라인, 트리맵 모두 적용됨)
    return tasks.filter(
      (t: any) =>
        t.groupId !== null && t.groupId !== undefined && t.groupId !== ""
    );
  } catch (e) {
    console.error("Notion Fetch Error:", e);
    return [];
  }
}

// ----------------------------------------------------------------------
// 2. API 데이터 가져오기 (Multi-Duration 수정)
// ----------------------------------------------------------------------
async function fetchAllApiData(groupIds: string[]) {
  const apiDataMap: Record<string, any> = {};

  // 각 그룹별로 4개의 기간 데이터를 모두 가져옵니다.
  await Promise.all(
    groupIds.map(async (id) => {
      try {
        const groupResult: Record<string, any> = {};

        await Promise.all(
          LOOKBACK_DAYS.map(async (days) => {
            const url = `${API_BASE_URL}/${id}/timeseries-group?limit=50&lookbacks=${days}`;
            // 개별 실패가 전체를 막지 않도록 처리
            try {
              const res = await fetch(url, { next: { revalidate: 3600 } });
              if (res.ok) {
                groupResult[String(days)] = await res.json();
              }
            } catch (innerE) {
              console.error(`Error fetching ${id} - ${days}d:`, innerE);
            }
          })
        );

        apiDataMap[id] = groupResult;
      } catch (e) {
        console.error(`API Fetch Error for Group ${id}:`, e);
      }
    })
  );
  return apiDataMap;
}

// ----------------------------------------------------------------------
// 유틸리티
// ----------------------------------------------------------------------
function parseKoreanDate(text: string) {
  if (!text) return { start: null, end: null };
  const matches = text.match(/(\d+)\s*월\s*(\d+)\s*일/g);
  if (!matches || matches.length === 0) return { start: null, end: null };

  const currentYear = new Date().getFullYear();
  const parseToISO = (dateStr: string) => {
    const m = dateStr.match(/(\d+)\s*월\s*(\d+)\s*일/);
    if (!m) return null;
    const date = new Date(
      currentYear,
      parseInt(m[1], 10) - 1,
      parseInt(m[2], 10)
    );
    return !isNaN(date.getTime()) ? date.toISOString() : null;
  };
  const start = parseToISO(matches[0]);
  const end = matches.length > 1 ? parseToISO(matches[1]) : start;
  return { start, end };
}

const getCachedNotion = unstable_cache(
  fetchNotionTasksRaw,
  ["storyteller-notion-v10"], // 캐시 키 업데이트
  { revalidate: 60 }
);

export default async function StorytellerPage() {
  const notionTasks = await getCachedNotion();

  // 1. GroupID 추출
  const uniqueGroupIds = Array.from(
    new Set(notionTasks.map((t: any) => t.groupId).filter((id: any) => id))
  ) as string[];

  if (uniqueGroupIds.length === 0) uniqueGroupIds.push("63");

  // 2. GroupID -> ProjectName 매핑
  const projectNames: Record<string, string> = {};
  notionTasks.forEach((t: any) => {
    if (t.groupId && t.title) {
      if (!projectNames[t.groupId]) {
        projectNames[t.groupId] = t.title;
      }
    }
  });

  // 3. API 데이터 가져오기
  const apiDataMap = await fetchAllApiData(uniqueGroupIds);

  // 4. [Fix] Hydration Error 방지를 위한 서버 시간 고정
  const now = new Date();
  const initialNow = now.getTime(); // 클라이언트로 전달할 타임스탬프
  const initialTodayStr = now.toLocaleDateString("en-CA"); // YYYY-MM-DD

  return (
    <StorytellerClient
      notionTasks={notionTasks}
      apiDataMap={apiDataMap}
      availableGroupIds={uniqueGroupIds}
      projectNames={projectNames}
      initialNow={initialNow} // [New]
      initialTodayStr={initialTodayStr} // [New]
    />
  );
}
