/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

const API_BASE_URL =
  "https://mashboard-api.despreadlabs.io/storyteller-leaderboard";
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_STORYTELLER_DB_ID;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  console.log("--> [Cron] Data Source Job Started (v2025-09-03)");

  // 1. 보안 체크
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (!NOTION_TOKEN || !DB_ID) {
    return NextResponse.json({ error: "Env missing" }, { status: 500 });
  }

  const today = new Date().toISOString().split("T")[0];
  const headers = {
    Authorization: `Bearer ${NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": "2025-09-03", // 최신 버전 명시
  };

  try {
    // ---------------------------------------------------------
    // 1. DB 메타데이터 조회
    // ---------------------------------------------------------
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${DB_ID}`, {
      headers,
    });
    if (!dbRes.ok) throw new Error(`DB Metadata Error: ${dbRes.statusText}`);

    const dbData = await dbRes.json();
    const dataSources = dbData.data_sources || [];

    if (dataSources.length === 0) {
      return NextResponse.json({
        error: "No Data Sources found. (Please check connection)",
      });
    }

    // ---------------------------------------------------------
    // 2. Data Source Query (필터 없이 조회 -> 로그 확인용)
    // ---------------------------------------------------------
    const allPages: any[] = [];

    await Promise.all(
      dataSources.map(async (source: any) => {
        const queryRes = await fetch(
          `https://api.notion.com/v1/data_sources/${source.id}/query`,
          {
            method: "POST",
            headers,
            // [중요] 필터를 잠시 뺐습니다! (일단 다 가져와서 속성 이름을 확인하기 위함)
            body: JSON.stringify({}),
          }
        );

        if (queryRes.ok) {
          const data = await queryRes.json();
          allPages.push(...(data.results || []));
        } else {
          console.error(
            `Query Error for Source ${source.id}:`,
            await queryRes.text()
          );
        }
      })
    );

    console.log(`Total Pages Found (No Filter): ${allPages.length}`);

    if (allPages.length > 0) {
      // [진단 로그] 첫 번째 페이지의 속성(Properties)을 통째로 출력
      // 이걸 보면 "Status"인지 "상태"인지, "진행 중"인지 확실히 알 수 있습니다.
      console.log(
        "--> [DEBUG] First Page Properties:",
        JSON.stringify(allPages[0].properties, null, 2)
      );
    }

    // ---------------------------------------------------------
    // 3. 필터링 (코드 내부에서 수행)
    // ---------------------------------------------------------
    // API 필터 대신 가져온 데이터에서 직접 찾습니다. (이게 훨씬 확실합니다)
    const targetProjects = allPages.filter((page: any) => {
      const props = page.properties;

      // 1. 상태값 확인 (유연하게 체크)
      const statusProp = props["Status"] || props["상태"] || props["status"];
      let statusValue = "";

      if (statusProp?.status) statusValue = statusProp.status.name;
      else if (statusProp?.select) statusValue = statusProp.select.name;

      // 2. 진행중 여부 체크 (띄어쓰기 등 모든 케이스 포함)
      const isActive = [
        "진행중",
        "진행 중",
        "In Progress",
        "Active",
        "Running",
      ].includes(statusValue);

      return isActive;
    });

    console.log(`--> Filtered Active Projects: ${targetProjects.length}`);

    // ---------------------------------------------------------
    // 4. GroupID 추출 및 저장
    // ---------------------------------------------------------
    const results = [];

    for (const page of targetProjects) {
      const props = page.properties;
      const groupProp =
        props["GroupID"] || props["Group ID"] || props["그룹ID"];

      let groupId = null;
      if (groupProp?.number) groupId = String(groupProp.number);
      else if (groupProp?.rich_text)
        groupId = groupProp.rich_text[0]?.plain_text;
      else if (groupProp?.title) groupId = groupProp.title[0]?.plain_text;

      if (groupId) {
        try {
          const apiUrl = `${API_BASE_URL}/${groupId}/timeseries-group?limit=20&lookbacks=30`;
          const res = await fetch(apiUrl);
          if (res.ok) {
            const data = await res.json();
            const filename = `history/${groupId}/${today}.json`;
            const blob = await put(filename, JSON.stringify(data), {
              access: "public",
              contentType: "application/json",
              addRandomSuffix: false,
            });
            console.log(`   Saved: ${filename}`);
            results.push({ groupId, url: blob.url });
          }
        } catch (e) {
          console.error(`   Error Group ${groupId}:`, e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      saved: results,
    });
  } catch (error) {
    console.error("Critical Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
