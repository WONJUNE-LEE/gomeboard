import { list } from "@vercel/blob";
import { NextResponse } from "next/server";

// 캐싱되지 않고 항상 최신 상태를 확인하도록 설정
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId");
  const date = searchParams.get("date");

  if (!groupId || !date) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  // Cron에서 저장한 파일 경로 패턴: history/groupId/YYYY-MM-DD.json
  const path = `history/${groupId}/${date}.json`;

  try {
    // 1. Vercel Blob에서 해당 경로의 파일 검색
    const { blobs } = await list({ prefix: path, limit: 1 });

    if (!blobs || blobs.length === 0) {
      console.log(`File not found in Blob: ${path}`);
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // 2. 파일의 다운로드 URL 가져오기
    const blobUrl = blobs[0].url;

    // 3. Blob URL에서 실제 JSON 데이터 가져오기
    const res = await fetch(blobUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch blob content: ${res.status}`);
    }
    const data = await res.json();

    // 4. 클라이언트에 데이터 반환
    return NextResponse.json(data);
  } catch (error) {
    console.error("History API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
