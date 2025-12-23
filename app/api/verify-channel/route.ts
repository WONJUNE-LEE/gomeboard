// app/api/verify-channel/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { channelId, userId } = await request.json();

    if (!channelId || !userId) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // 1. 입력값 정제 (URL이나 @가 있어도 ID만 추출)
    // 예: https://t.me/my_channel -> @my_channel
    let cleanId = channelId.trim();
    if (cleanId.includes("t.me/")) {
      cleanId = cleanId.split("t.me/")[1].split("/")[0]; // URL에서 ID 추출
    }
    cleanId = cleanId.replace("@", ""); // @ 제거
    const chatId = `@${cleanId}`; // API 호출용으로 @ 다시 부착

    // 2. [API 1] 채널 기본 정보 및 구독자 수 가져오기 (getChat)
    const chatRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`
    );
    const chatData = await chatRes.json();

    if (!chatData.ok) {
      return NextResponse.json(
        {
          success: false,
          message: "채널을 찾을 수 없습니다. 봇이 추가되었는지 확인해주세요.",
        },
        { status: 400 }
      );
    }

    // 3. [API 2] 관리자 권한 검증 (getChatMember)
    const memberRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`
    );
    const memberData = await memberRes.json();

    if (!memberData.ok || !["creator"].includes(memberData.result.status)) {
      return NextResponse.json(
        { success: false, message: "소유주 권한이 확인되지 않았습니다." },
        { status: 403 }
      );
    }

    // 4. [API 3] 프로필 사진 가져오기 (있다면)
    let photoUrl = null;
    if (chatData.result.photo?.big_file_id) {
      const fileRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${chatData.result.photo.big_file_id}`
      );
      const fileData = await fileRes.json();
      if (fileData.ok) {
        // 텔레그램 파일 경로를 실제 URL로 변환
        photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
      }
    }

    // 5. 성공 결과 리턴 (구독자 수, 제목, 이미지 포함)
    return NextResponse.json({
      success: true,
      role: memberData.result.status,
      channel: {
        id: cleanId, // @ 뺀 순수 ID
        title: chatData.result.title, // 채널명
        subscribers: chatData.result.count, // 구독자 수 (봇이 권한 있어야 보일 수 있음)
        photoUrl: photoUrl, // 프로필 이미지 URL
        url: `https://t.me/${cleanId}`,
      },
    });
  } catch (error) {
    console.error("Verification Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
