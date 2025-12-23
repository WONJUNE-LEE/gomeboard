/* eslint-disable @typescript-eslint/no-explicit-any */
// app/mypage/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";

// ----------------------------------------------------------------------
// [타입 정의]
// ----------------------------------------------------------------------
interface ChannelData {
  handle: string;
  title: string;
  subscribers?: number;
  photoUrl: string | null;
  url: string;
  role?: string;
}

interface LeaderboardItem {
  campaign: string;
  rank: number;
  score: number;
  change: number;
  handle: string;
}

export default function MyPage() {
  const {
    user,
    ready,
    authenticated,
    linkTelegram,
    unlinkTelegram,
    linkGoogle,
    unlinkGoogle,
    linkApple,
    unlinkApple,
    linkTwitter,
    unlinkTwitter,
    linkDiscord,
    unlinkDiscord,
    linkEmail,
    unlinkEmail,
    linkWallet,
    unlinkWallet,
  } = usePrivy();

  // [State]
  const [channelInput, setChannelInput] = useState("");
  const [myChannel, setMyChannel] = useState<ChannelData | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [myRanks, setMyRanks] = useState<LeaderboardItem[]>([]);
  const [isLoadingRank, setIsLoadingRank] = useState(false);

  // 1. 초기화
  useEffect(() => {
    const saved = localStorage.getItem("my_telegram_channel");
    if (saved) setMyChannel(JSON.parse(saved));
  }, []);

  // 2. 랭킹 조회
  useEffect(() => {
    if (myChannel?.handle) fetchMyRank(myChannel.handle);
  }, [myChannel]);

  const fetchMyRank = async (handle: string) => {
    setIsLoadingRank(true);
    try {
      const response = await fetch("/api/my-rank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle }),
      });
      const data = await response.json();
      setMyRanks(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingRank(false);
    }
  };

  const cleanInput = (input: string) => {
    let clean = input.trim();
    if (clean.includes("t.me/")) clean = clean.split("t.me/")[1].split("/")[0];
    return clean
      .replace("@", "")
      .replace("https://", "")
      .replace("http://", "");
  };

  const handleVerifyChannel = async () => {
    if (!channelInput || !user?.telegram?.telegramUserId) return;
    const cleanId = cleanInput(channelInput);

    setIsVerifying(true);
    try {
      const response = await fetch("/api/verify-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: cleanId,
          userId: user.telegram.telegramUserId,
        }),
      });
      const data = await response.json();

      if (data.success) {
        const channelData: ChannelData = {
          handle: data.channel.id,
          title: data.channel.title,
          // 백엔드에서 subscribers를 제대로 주는지 확인 필요 (없으면 0)
          subscribers: data.channel.subscribers || 0,
          photoUrl: data.channel.photoUrl,
          url: data.channel.url,
          role: data.role,
        };
        setMyChannel(channelData);
        localStorage.setItem(
          "my_telegram_channel",
          JSON.stringify(channelData)
        );
        setChannelInput("");
        fetchMyRank(channelData.handle);
      } else {
        alert(`❌ 검증 실패: ${data.message || "오류가 발생했습니다."}`);
      }
    } catch (e) {
      alert("서버 오류가 발생했습니다.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDeleteChannel = () => {
    if (confirm("채널 연동을 해제하시겠습니까?")) {
      setMyChannel(null);
      setMyRanks([]);
      localStorage.removeItem("my_telegram_channel");
    }
  };

  if (!ready || !authenticated || !user) return null;

  const isTelegramLinked = !!user.telegram;
  const isChannelLinked = !!myChannel;

  // 배너 콘텐츠 로직
  const getBannerContent = () => {
    if (!isTelegramLinked) {
      return {
        type: "warning",
        title: "텔레그램 계정 연동 필요",
        desc: "서비스 참여를 위해 텔레그램을 먼저 연결해주세요.",
      };
    }
    if (isTelegramLinked && !isChannelLinked) {
      return {
        type: "warning",
        title: "채널 소유권 인증 필요",
        desc: "리더보드 확인을 위해 운영 중인 채널을 인증해주세요.",
      };
    }
    // [수정] 성공 상태에서도 안내문 유지
    return {
      type: "info",
      title: "연동 상태 유지 필수",
      desc: "캠페인 보상 지급을 위해 계정과 채널 연동 상태를 계속 유지해주세요.",
    };
  };

  const banner = getBannerContent();
  const profileImage =
    user.telegram?.photoUrl || user.twitter?.profilePictureUrl || null;
  const displayName =
    user.telegram?.username ||
    user.twitter?.username ||
    user.google?.name ||
    user.email?.address ||
    "User";

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans">
      <main className="max-w-[1200px] mx-auto px-4 py-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm">계정 및 활동 관리</p>
          </div>
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            ← Home
          </Link>
        </div>

        {/* 메인 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ==================================================================================
              [왼쪽 컬럼] 계정 정보 (lg:col-span-7)
              ================================================================================== */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. 상단: 프로필 + 채널 (한 줄 배치, 높이 맞춤) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* [좌] 프로필 카드 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 relative overflow-hidden h-[88px]">
                <div className="relative shrink-0">
                  <img
                    src={profileImage || ""}
                    alt=""
                    className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm bg-gray-100"
                  />
                  {!profileImage && (
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold border-2 border-white">
                      {displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {isTelegramLinked && (
                    <div
                      className="absolute -bottom-1 -right-1 bg-[#2AABEE] text-white p-0.5 rounded-full border-2 border-white shadow-sm z-10"
                      title="Telegram Verified"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 text-base leading-tight truncate">
                    {displayName}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {isTelegramLinked ? "Verified User" : "Guest"}
                  </p>
                </div>
              </div>

              {/* [우] 채널 설정 카드 */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-center h-[88px]">
                {!isTelegramLinked ? (
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-gray-500 flex-1">
                      채널 설정을 위해
                      <br />
                      먼저 로그인하세요.
                    </p>
                    <button
                      onClick={() => linkTelegram()}
                      className="bg-black text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-800 shrink-0"
                    >
                      Connect
                    </button>
                  </div>
                ) : !myChannel ? (
                  <div className="space-y-2">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="@channel"
                        value={channelInput}
                        onChange={(e) => setChannelInput(e.target.value)}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#2AABEE] outline-none"
                      />
                      <button
                        onClick={handleVerifyChannel}
                        disabled={!channelInput || isVerifying}
                        className="bg-[#2AABEE] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#229ED9] whitespace-nowrap"
                      >
                        인증
                      </button>
                    </div>
                    <p className="text-[9px] text-gray-400">
                      * <strong>@gome_login_bot</strong> 관리자 추가 필수
                    </p>
                  </div>
                ) : (
                  // [수정] 인증된 채널 정보: 한 줄 배치 & 휴지통 아이콘
                  <div className="flex items-center justify-between w-full gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0 overflow-hidden relative border border-gray-100">
                        {myChannel.photoUrl ? (
                          <img
                            src={myChannel.photoUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#2AABEE] font-bold text-sm bg-blue-50">
                            {myChannel.title[0]}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <h4 className="font-bold text-sm text-gray-900 truncate max-w-[100px]">
                            {myChannel.title}
                          </h4>
                          <span className="text-[8px] bg-green-50 text-green-600 px-1 rounded border border-green-100 font-bold">
                            OWNER
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">
                          @{myChannel.handle} ·{" "}
                          {myChannel.subscribers
                            ? myChannel.subscribers.toLocaleString()
                            : "-"}{" "}
                          subs
                        </p>
                      </div>
                    </div>

                    {/* [수정] 휴지통 아이콘 (연동 해제) */}
                    <button
                      onClick={handleDeleteChannel}
                      className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all shrink-0"
                      title="연동 해제"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. 안내 배너 (성공 시에도 표시됨 - Type: Info) */}
            <div
              className={`border rounded-2xl p-4 flex items-center gap-4 shadow-sm ${
                banner.type === "success" || banner.type === "info"
                  ? "bg-blue-50/50 border-blue-100"
                  : "bg-orange-50/50 border-orange-100"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-base ${
                  banner.type === "success" || banner.type === "info"
                    ? "bg-blue-100 text-blue-600"
                    : "bg-orange-100 text-orange-600"
                }`}
              >
                {banner.type === "success" || banner.type === "info"
                  ? "i"
                  : "!"}
              </div>
              <div className="flex-1">
                <h3
                  className={`font-bold text-xs mb-0.5 ${
                    banner.type === "success" || banner.type === "info"
                      ? "text-blue-800"
                      : "text-orange-800"
                  }`}
                >
                  {banner.title}
                </h3>
                <p
                  className={`text-[11px] ${
                    banner.type === "success" || banner.type === "info"
                      ? "text-blue-600"
                      : "text-orange-600"
                  }`}
                >
                  {banner.desc}
                </p>
              </div>
            </div>

            {/* 3. 연결된 계정 리스트 (모든 계정 복구) */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <div className="px-5 py-3 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 text-sm">
                  Linked Accounts
                </h3>
              </div>
              <div className="divide-y divide-gray-50">
                <AccountRow
                  icon="✈️"
                  name="Telegram"
                  isConnected={!!user.telegram}
                  identifier={user.telegram?.username}
                  onLink={linkTelegram}
                  onUnlink={() => unlinkTelegram(user.telegram!.telegramUserId)}
                  isPrimary={true}
                />
                <AccountRow
                  icon="G"
                  name="Google"
                  isConnected={!!user.google}
                  identifier={user.google?.email}
                  onLink={linkGoogle}
                  onUnlink={() => unlinkGoogle(user.google!.subject)}
                />
                <AccountRow
                  icon="🍎"
                  name="Apple"
                  isConnected={!!user.apple}
                  identifier={user.apple?.email}
                  onLink={linkApple}
                  onUnlink={() => unlinkApple(user.apple!.subject)}
                />
                <AccountRow
                  icon="𝕏"
                  name="Twitter"
                  isConnected={!!user.twitter}
                  identifier={user.twitter?.username}
                  onLink={linkTwitter}
                  onUnlink={() => unlinkTwitter(user.twitter!.subject)}
                />
                <AccountRow
                  icon="👾"
                  name="Discord"
                  isConnected={!!user.discord}
                  identifier={user.discord?.username}
                  onLink={linkDiscord}
                  onUnlink={() => unlinkDiscord(user.discord!.subject)}
                />
                <AccountRow
                  icon="✉️"
                  name="Email"
                  isConnected={!!user.email}
                  identifier={user.email?.address}
                  onLink={linkEmail}
                  onUnlink={() => unlinkEmail(user.email!.address)}
                />
                <AccountRow
                  icon="🦊"
                  name="Wallet"
                  isConnected={!!user.wallet}
                  identifier={
                    user.wallet?.address
                      ? `${user.wallet.address.slice(0, 6)}...`
                      : null
                  }
                  onLink={linkWallet}
                  onUnlink={() => unlinkWallet(user.wallet!.address)}
                />
              </div>
            </div>
          </div>

          {/* ==================================================================================
              [오른쪽 컬럼] 리더보드 (lg:col-span-5)
              ================================================================================== */}
          <div className="lg:col-span-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">My Rankings</h2>
              {isChannelLinked && (
                <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                  Live
                </span>
              )}
            </div>

            {!isChannelLinked ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center flex flex-col items-center justify-center h-64">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-2xl mb-3 grayscale opacity-50">
                  🔒
                </div>
                <p className="text-sm font-bold text-gray-600">
                  Rankings Locked
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  채널 인증 후 확인 가능합니다.
                </p>
              </div>
            ) : isLoadingRank ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="aspect-[4/3] bg-gray-200 rounded-2xl animate-pulse"
                  ></div>
                ))}
              </div>
            ) : myRanks.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {myRanks.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-[#2AABEE] transition-colors group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-[14px] text-gray-400 font-bold group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                        {item.campaign.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="text-right">
                        <span className="block text-xl font-bold text-[#0037F0]">
                          #{item.rank}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h4
                        className="font-bold text-gray-900 text-sm truncate mb-1"
                        title={item.campaign}
                      >
                        {item.campaign}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-medium text-gray-600">
                          {item.score.toLocaleString()}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            item.change > 0
                              ? "text-red-500"
                              : item.change < 0
                              ? "text-blue-500"
                              : "text-gray-400"
                          }`}
                        >
                          {item.change !== 0
                            ? item.change > 0
                              ? `▲${item.change}`
                              : `▼${Math.abs(item.change)}`
                            : "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center h-64 flex flex-col items-center justify-center">
                <div className="text-2xl mb-2">📉</div>
                <p className="text-sm font-bold text-gray-900">No Data</p>
                <p className="text-xs text-gray-500 mt-1">
                  30일 내 활동 기록이 없습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------
// AccountRow (Compact)
// ----------------------------------------------------------------------
function AccountRow({
  icon,
  name,
  isConnected,
  identifier,
  onLink,
  onUnlink,
  isPrimary = false,
}: any) {
  return (
    <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm ${
            isConnected
              ? "bg-white border border-gray-100"
              : "bg-gray-100 text-gray-400 grayscale"
          }`}
        >
          {icon === "G" ? (
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
              />
            </svg>
          ) : (
            icon
          )}
        </div>
        <div>
          <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5">
            {name}{" "}
            {isPrimary && isConnected && (
              <span className="bg-blue-100 text-blue-600 text-[9px] px-1 py-0.5 rounded font-extrabold leading-none">
                MAIN
              </span>
            )}
          </h4>
          <p className="text-[10px] text-gray-500 font-medium max-w-[150px] truncate">
            {isConnected ? identifier || "Connected" : "Not linked"}
          </p>
        </div>
      </div>
      <button
        onClick={isConnected ? onUnlink : onLink}
        className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all border ${
          isConnected
            ? "border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
            : "border-black bg-black text-white hover:bg-gray-800 hover:scale-105 shadow-sm"
        }`}
      >
        {isConnected ? "Unlink" : "Connect"}
      </button>
    </div>
  );
}
