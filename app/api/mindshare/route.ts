import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // 캐싱 방지 및 실시간 데이터 페칭

export async function GET(request: Request) {
  try {
    // 1. 클라이언트에서 보낸 쿼리 파라미터(intervalDays, limit 등)를 그대로 추출
    const { searchParams } = new URL(request.url);
    const queryString = searchParams.toString();

    // 2. 외부 API로 서버 사이드 요청 (서버 간 통신이라 CORS 문제 없음)
    const apiUrl = `https://mashboard-api.despreadlabs.io/telegram/mindshare/community?${queryString}`;

    const res = await fetch(apiUrl, {
      headers: {
        "Content-Type": "application/json",
      },
      // 필요하다면 캐시 설정 (예: 60초)
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from external API" },
        { status: res.status }
      );
    }

    const data = await res.json();

    // 3. 데이터를 그대로 클라이언트에 반환
    return NextResponse.json(data);
  } catch (error) {
    console.error("Mindshare Proxy Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
