/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const STORYTELLER_DB_ID = process.env.NOTION_STORYTELLER_DB_ID;
const API_BASE_URL =
  "https://mashboard-api.despreadlabs.io/storyteller-leaderboard";

// ----------------------------------------------------------------------
// 1. 노션 데이터 가져오기 (9월 업데이트: Data Source 로직 반영)
// ----------------------------------------------------------------------
async function fetchNotionProjects() {
  if (!NOTION_TOKEN || !STORYTELLER_DB_ID) {
    console.error("❌ [API] 환경변수 누락");
    return [];
  }

  const headers = {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    "Content-Type": "application/json",
    // [중요] 사용자가 언급한 9월 업데이트 버전 적용
    "Notion-Version": "2025-09-03",
  };

  try {
    // [Step 1] DB 메타데이터 조회 (Data Source 확인용)
    const dbRes = await fetch(
      `https://api.notion.com/v1/databases/${STORYTELLER_DB_ID}`,
      { headers, next: { revalidate: 60 } }
    );

    if (!dbRes.ok) {
      console.error(`❌ [API] DB 조회 실패: ${dbRes.status}`);
      return [];
    }

    const dbData = await dbRes.json();
    const dataSources = dbData.data_sources || [];
    const allResults: any[] = [];

    // [Step 2] 데이터 조회 분기 처리 (Source vs Legacy)
    if (dataSources.length === 0) {
      // (구 방식) 직접 쿼리
      const legacyRes = await fetch(
        `https://api.notion.com/v1/databases/${STORYTELLER_DB_ID}/query`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ page_size: 100 }),
          next: { revalidate: 60 },
        }
      );
      if (legacyRes.ok) {
        const data = await legacyRes.json();
        allResults.push(...(data.results || []));
      }
    } else {
      // (신 방식) Data Source별 쿼리
      await Promise.all(
        dataSources.map(async (source: any) => {
          try {
            const queryRes = await fetch(
              `https://api.notion.com/v1/data_sources/${source.id}/query`,
              {
                method: "POST",
                headers,
                body: JSON.stringify({ page_size: 100 }),
                next: { revalidate: 60 },
              }
            );
            if (queryRes.ok) {
              const data = await queryRes.json();
              allResults.push(...(data.results || []));
            }
          } catch (err) {
            console.error(`⚠️ [API] Source(${source.id}) 조회 실패:`, err);
          }
        })
      );
    }

    console.log(`✅ [API] Notion 데이터 ${allResults.length}건 확보`);

    // [Step 3] 데이터 매핑 (Project Title & GroupID 추출)
    const projects = allResults
      .map((page: any) => {
        const props = page.properties || {};

        // 제목
        const titleProp =
          props["프로젝트"] ||
          props["이름"] ||
          props["Name"] ||
          props["Title"] ||
          props["제목"];
        const title = titleProp?.title?.[0]?.plain_text || "Untitled";

        // GroupID
        const groupProp =
          props["GroupID"] || props["Group ID"] || props["그룹ID"];
        let groupId: string | null = null;
        if (groupProp?.type === "number")
          groupId = groupProp.number?.toString();
        else if (groupProp?.type === "rich_text")
          groupId = groupProp.rich_text?.[0]?.plain_text;
        else if (groupProp?.type === "select") groupId = groupProp.select?.name;

        return { title, groupId };
      })
      .filter((p: any) => p.groupId); // GroupID 있는 것만

    return projects;
  } catch (e) {
    console.error("❌ [API] Notion 로직 에러:", e);
    return [];
  }
}

// ----------------------------------------------------------------------
// 2. API 핸들러
// ----------------------------------------------------------------------
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawHandle = body.handle || "";
    // 핸들 정규화
    const targetHandle = rawHandle.replace("@", "").trim().toLowerCase();

    console.log(`🔍 [API] 요청 핸들: "${targetHandle}"`);

    if (!targetHandle) {
      return NextResponse.json({ error: "Handle required" }, { status: 400 });
    }

    // 1. 노션 프로젝트 목록 가져오기 (수정된 함수 사용)
    const projects = await fetchNotionProjects();
    const myRankings: any[] = [];

    if (projects.length === 0) {
      console.log("⚠️ [API] 프로젝트 목록이 비어있습니다.");
      return NextResponse.json([]);
    }

    // 2. Mashboard API 호출
    await Promise.all(
      projects.map(async (project: any) => {
        try {
          const url = `${API_BASE_URL}/${project.groupId}/timeseries-group?limit=100&lookbacks=30`;
          const apiRes = await fetch(url, { next: { revalidate: 60 } });

          if (!apiRes.ok) return;

          const data = await apiRes.json();

          if (data && Array.isArray(data.channels)) {
            const myEntry = data.channels.find((c: any) => {
              const apiHandle = (c.channelUsername || "")
                .replace("@", "")
                .trim()
                .toLowerCase();
              return apiHandle === targetHandle;
            });

            if (myEntry) {
              const rank = data.channels.indexOf(myEntry) + 1;

              let change = 0;
              if (myEntry.series && myEntry.series.length >= 2) {
                const today = myEntry.series[myEntry.series.length - 1].score;
                const yesterday =
                  myEntry.series[myEntry.series.length - 2].score;
                change = Math.floor(today - yesterday);
              }

              myRankings.push({
                campaign: project.title,
                rank: rank,
                score: Math.floor(myEntry.score),
                change: change,
                handle: myEntry.channelUsername,
              });
            }
          }
        } catch (innerError) {
          console.error(`Error fetching group ${project.groupId}:`, innerError);
        }
      })
    );

    console.log(`🏁 [API] 최종 결과: ${myRankings.length}건 발견`);
    myRankings.sort((a, b) => b.score - a.score);

    return NextResponse.json(myRankings);
  } catch (error) {
    console.error("❌ [API] 서버 에러:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
