/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";

// ----------------------------------------------------------------------
// 타입 정의
// ----------------------------------------------------------------------
interface SeriesPoint {
  date: string;
  score: number;
  mentionCount: number;
}
interface DailyPoint {
  date: string;
  dailyScore: number;
}
interface ChannelData {
  channelId: string;
  channelTitle: string;
  channelUsername?: string;
  score: number;
  mentionCount: number;
  profileImageUrl?: string;
  series: SeriesPoint[];
  dailySeries?: DailyPoint[];
}
interface NotionTask {
  id: string;
  title: string;
  groupId: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  status: string;
  category: string;
  manager: string;
  managerImg: string | null;
}

// ----------------------------------------------------------------------
// [Utility] 스파크라인 및 커스텀 렌더러
// ----------------------------------------------------------------------
function generateSparklinePath(data: number[], width: number, height: number) {
  if (!data || data.length === 0) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const paddingY = 5;
  const drawHeight = height - paddingY * 2;
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const normalizedVal = (val - min) / range;
    const y = height - paddingY - normalizedVal * drawHeight;
    return `${x},${y}`;
  });
  return `M ${points.join(" L ")}`;
}

const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, value, totalScore } = props;
  const itemData = props.itemData || props.payload?.itemData;
  if (!itemData || width < 50 || height < 50) return null;

  // Thresholds
  const isLarge = width > 200 && height > 160;
  const isMedium = !isLarge && width > 120 && height > 100;
  const isSmall = !isLarge && !isMedium;

  const percentage = ((value / totalScore) * 100).toFixed(1);
  const dailySeries = itemData.dailySeries || [];
  const dailyScores = dailySeries.map((s: DailyPoint) => s.dailyScore);
  const isGrowing =
    (dailyScores[dailyScores.length - 1] || 0) >= (dailyScores[0] || 0);

  const tintColor = isGrowing
    ? "rgba(16, 185, 129, 0.1)"
    : "rgba(244, 63, 94, 0.1)";
  const borderColor = isGrowing
    ? "rgba(16, 185, 129, 0.4)"
    : "rgba(244, 63, 94, 0.4)";
  const sparklineColor = isGrowing ? "#10B981" : "#F43F5E";

  const gap = 8;
  const drawX = x + gap / 2;
  const drawY = y + gap / 2;
  const drawWidth = width - gap;
  const drawHeight = height - gap;

  const sparklinePath = isLarge
    ? generateSparklinePath(dailyScores, drawWidth - 32, drawHeight * 0.25)
    : "";

  return (
    <foreignObject
      x={drawX}
      y={drawY}
      width={drawWidth}
      height={drawHeight}
      style={{ overflow: "visible" }}
    >
      <div
        className="w-full h-full rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl group relative overflow-hidden flex flex-col justify-between p-3"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.3) 0%, ${tintColor} 100%)`,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: `1px solid ${borderColor}`,
          boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.05)",
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />
        <div
          className={`relative z-10 w-full h-full flex ${
            isSmall
              ? "flex-col items-center justify-center gap-1"
              : "flex-col justify-between"
          }`}
        >
          <div
            className={`flex ${
              isSmall ? "flex-col items-center" : "items-start gap-2"
            }`}
          >
            {itemData.profileImageUrl && (
              <div className="relative shrink-0">
                <img
                  src={itemData.profileImageUrl}
                  alt=""
                  className={`${
                    isSmall ? "w-8 h-8" : "w-10 h-10"
                  } rounded-full object-cover shadow-sm ring-2 ring-white/60 transition-all`}
                />
                <div
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white/50 ${
                    isGrowing ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
              </div>
            )}
            {!isSmall && (
              <div className="min-w-0 flex-1 pt-0.5">
                <p
                  className="text-[13px] font-bold text-gray-800 leading-tight truncate drop-shadow-sm"
                  title={name}
                >
                  {name}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-md backdrop-blur-md shadow-sm ${
                      isGrowing
                        ? "bg-emerald-50/50 text-emerald-800"
                        : "bg-rose-50/50 text-rose-800"
                    }`}
                  >
                    {percentage}%
                  </span>
                </div>
              </div>
            )}
            {isSmall && (
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full backdrop-blur-md shadow-sm mt-1 ${
                  isGrowing
                    ? "bg-emerald-50/80 text-emerald-800"
                    : "bg-rose-50/80 text-rose-800"
                }`}
              >
                {percentage}%
              </span>
            )}
          </div>
          {isLarge && (
            <div className="absolute bottom-4 left-4 right-4 h-1/4 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
              <svg width="100%" height="100%" overflow="visible">
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke={sparklineColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="drop-shadow(0px 2px 2px rgba(0,0,0,0.1))"
                />
              </svg>
            </div>
          )}
          {!isSmall && (
            <div className="relative z-10 text-right mt-auto">
              <p className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold mb-0.5 mix-blend-multiply">
                Total Score
              </p>
              <p className="text-sm font-black text-gray-800 tabular-nums tracking-tight">
                {Math.round(value).toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>
    </foreignObject>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const item = data.itemData as ChannelData;
    if (!item) return null;
    return (
      <div className="bg-white/90 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 p-4 rounded-2xl text-sm z-50 min-w-[200px]">
        <div className="flex items-center gap-3 mb-4">
          {item.profileImageUrl && (
            <img
              src={item.profileImageUrl}
              alt=""
              className="w-10 h-10 rounded-full shadow-md ring-2 ring-white"
            />
          )}
          <div>
            <p className="font-bold text-gray-900 text-base">
              {item.channelTitle}
            </p>
            <p className="text-gray-500 text-xs">@{item.channelId}</p>
          </div>
        </div>
        <div className="space-y-2 bg-white/50 rounded-xl p-3 border border-white/60">
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-500 text-xs font-medium">
              Total Score
            </span>
            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg text-xs">
              {Math.round(item.score).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <span className="text-gray-500 text-xs font-medium">
              Latest Daily
            </span>
            <span className="font-bold text-gray-800">
              {item.dailySeries && item.dailySeries.length > 0
                ? Math.round(
                    item.dailySeries[item.dailySeries.length - 1].dailyScore
                  ).toLocaleString()
                : "-"}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// ----------------------------------------------------------------------
// 메인 클라이언트 컴포넌트
// ----------------------------------------------------------------------
export default function StorytellerClient({
  apiDataMap: initialApiDataMap,
  notionTasks,
  availableGroupIds,
  projectNames,
  initialNow, // [New] Props
  initialTodayStr, // [New] Props
}: {
  apiDataMap: Record<string, any>;
  notionTasks: NotionTask[];
  availableGroupIds: string[];
  projectNames: Record<string, string>;
  initialNow: number;
  initialTodayStr: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryGroupId = searchParams.get("groupId");
  // [Fix] Server Time을 기준으로 초기값 설정 (Hydration Error 방지)
  const todayStr = useMemo(() => initialTodayStr, [initialTodayStr]);
  const initialDateObj = useMemo(() => new Date(initialNow), [initialNow]);

  // [State] UI 상태
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    queryGroupId && availableGroupIds.includes(queryGroupId)
      ? queryGroupId
      : availableGroupIds[0] || "63"
  );

  // [State] 기간 선택 (Default: 30)
  const [lookback, setLookback] = useState<number>(30);

  const [currentDataMap, setCurrentDataMap] = useState(initialApiDataMap);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Grouping Logic (Active / Finished)
  const { activeIds, finishedIds } = useMemo(() => {
    const activeStatuses = [
      "진행중",
      "In Progress",
      "진행 중",
      "Ongoing",
      "Running",
      "Active",
    ];
    const active: string[] = [];
    const finished: string[] = [];
    availableGroupIds.forEach((id) => {
      const task = notionTasks.find((t) => t.groupId === id);
      if (task && activeStatuses.includes(task.status)) active.push(id);
      else finished.push(id);
    });
    return { activeIds: active, finishedIds: finished };
  }, [availableGroupIds, notionTasks]);

  useEffect(() => {
    if (queryGroupId && availableGroupIds.includes(queryGroupId)) {
      if (selectedGroupId !== queryGroupId) setSelectedGroupId(queryGroupId);
    }
  }, [queryGroupId, availableGroupIds, selectedGroupId]);

  const handleTabClick = (id: string) => {
    setSelectedGroupId(id);
    router.push(`?groupId=${id}`, { scroll: false });
  };

  // Fetch History on Date Change
  useEffect(() => {
    async function fetchHistory() {
      if (selectedDate === todayStr) {
        setCurrentDataMap(initialApiDataMap);
        return;
      }
      setIsLoadingHistory(true);
      try {
        const res = await fetch(
          `/api/history?groupId=${selectedGroupId}&date=${selectedDate}`
        );
        if (res.ok) {
          const historyData = await res.json();
          setCurrentDataMap((prev) => ({
            ...prev,
            [selectedGroupId]: historyData,
          }));
        } else {
          alert(`No data found for ${selectedDate}`);
          setSelectedDate(todayStr);
        }
      } catch (e) {
        console.error("Failed to fetch history:", e);
        alert("Failed to load historical data.");
      } finally {
        setIsLoadingHistory(false);
      }
    }
    fetchHistory();
  }, [selectedDate, selectedGroupId, todayStr, initialApiDataMap]);

  // [Data Selector]
  const currentGroupAllData = currentDataMap[selectedGroupId];

  const currentApiData = useMemo(() => {
    if (!currentGroupAllData) return null;
    if (currentGroupAllData["30"] || currentGroupAllData["7"]) {
      return currentGroupAllData[lookback.toString()];
    }
    if (lookback === 30) {
      return currentGroupAllData;
    }
    return null;
  }, [currentGroupAllData, lookback]);

  // TreeMap Data Processing
  const { treeMapData, totalScore } = useMemo(() => {
    if (!currentApiData?.channels) return { treeMapData: [], totalScore: 0 };
    const channels: ChannelData[] = currentApiData.channels;
    const total = channels.reduce((sum, ch) => sum + ch.score, 0);
    const data = channels.map((ch) => {
      const rawSeries = ch.series || [];
      const dailySeries: DailyPoint[] = [];
      for (let i = 1; i < rawSeries.length; i++) {
        const prev = rawSeries[i - 1];
        const curr = rawSeries[i];
        const dailyScore = curr.score - prev.score;
        dailySeries.push({
          date: curr.date,
          dailyScore: dailyScore < 0 ? 0 : dailyScore,
        });
      }
      return {
        name: ch.channelTitle,
        value: ch.score,
        itemData: { ...ch, dailySeries },
      };
    });
    data.sort((a, b) => b.value - a.value);
    return { treeMapData: data, totalScore: total };
  }, [currentApiData]);

  const treemapVisualData = useMemo(
    () => treeMapData.slice(0, 20),
    [treeMapData]
  );
  const rankingData = treeMapData;

  // Schedule Logic
  const { startDate, totalDays, dateHeaders } = useMemo(() => {
    const baseDate = new Date();
    if (notionTasks.length === 0) {
      const start = new Date(baseDate);
      start.setDate(start.getDate() - 3);
      return { startDate: start, totalDays: 30, dateHeaders: [] };
    }
    const dates = notionTasks
      .map((t) => [new Date(t.dateStart || ""), new Date(t.dateEnd || "")])
      .flat()
      .filter((d) => !isNaN(d.getTime()))
      .map((d) => d.getTime());
    const min = dates.length ? Math.min(...dates) : baseDate.getTime();
    const max = dates.length
      ? Math.max(...dates)
      : baseDate.getTime() + 86400000 * 30;
    const start = new Date(min);
    start.setDate(start.getDate() - 3);
    const end = new Date(max);
    end.setDate(end.getDate() + 7);
    const diffDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const headers = [];
    for (let i = 0; i <= diffDays; i += 7) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      headers.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        left: (i / diffDays) * 100,
      });
    }
    return {
      startDate: start,
      totalDays: diffDays || 30,
      dateHeaders: headers,
    };
  }, [notionTasks]);

  const getDatePosition = (dateStr: string | null) => {
    if (!dateStr) return 0;
    const diff = new Date(dateStr).getTime() - startDate.getTime();
    return Math.max(0, (diff / (1000 * 60 * 60 * 24) / totalDays) * 100);
  };
  const getDurationWidth = (startStr: string | null, endStr: string | null) => {
    if (!startStr) return 0;
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : start;
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
    return (days / totalDays) * 100;
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <main className="max-w-[1600px] mx-auto px-6 py-12">
        {/* ======================= Header Section ======================= */}
        <div className="flex flex-col gap-6 mb-10">
          {/* Row 1: Title & Controls (Right Aligned) */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            {/* Left: Title */}
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">
                Storyteller
              </h1>
              <p className="text-gray-500 text-lg font-medium">
                Influence Intelligence & Content Scheduling
              </p>
            </div>

            {/* Right: Controls (Period & Date) */}
            <div className="flex flex-wrap items-end gap-6">
              {/* Period Selector */}
              <div className="flex flex-col items-end">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Period
                </label>
                <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-200">
                  {[7, 14, 30, 90].map((days) => (
                    <button
                      key={days}
                      onClick={() => setLookback(days)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        lookback === days
                          ? "bg-gray-900 text-white shadow-md"
                          : "text-gray-500 hover:bg-gray-100"
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Machine */}
              <div className="flex flex-col items-end">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                  {selectedDate !== todayStr && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  )}
                  Time Machine
                </label>
                <div className="relative group">
                  <input
                    type="date"
                    value={selectedDate}
                    max={todayStr}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className={`
                      appearance-none bg-white border rounded-xl px-4 py-2 text-sm font-bold shadow-sm outline-none transition-all duration-200
                      ${
                        selectedDate !== todayStr
                          ? "border-indigo-300 ring-2 ring-indigo-100 text-indigo-700"
                          : "border-gray-200 text-gray-700 hover:border-gray-300 focus:ring-2 focus:ring-gray-100"
                      }
                    `}
                  />
                  {selectedDate !== todayStr && (
                    <button
                      onClick={() => setSelectedDate(todayStr)}
                      className="absolute -bottom-6 right-0 text-[10px] text-indigo-500 hover:underline font-medium"
                    >
                      Reset to Today
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Project Tabs (Wide Bar) */}
          <div className="w-full bg-white/60 p-2 rounded-2xl border border-gray-200/60 backdrop-blur-md shadow-sm">
            <div className="flex flex-col gap-2">
              {/* Active Projects */}
              {activeIds.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50 px-2 py-1 rounded shrink-0">
                    Active
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => handleTabClick(id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                          selectedGroupId === id
                            ? "bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200 scale-[1.02]"
                            : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                        }`}
                      >
                        {projectNames[id] || `Project #${id}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Separator (if both exist) */}
              {finishedIds.length > 0 && activeIds.length > 0 && (
                <div className="h-px bg-gray-200/50 w-full" />
              )}

              {/* Finished Projects */}
              {finishedIds.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded shrink-0">
                    Finished
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {finishedIds.map((id) => (
                      <button
                        key={id}
                        onClick={() => handleTabClick(id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                          selectedGroupId === id
                            ? "bg-gray-100 text-gray-600 shadow-inner ring-1 ring-gray-200/50"
                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100/30"
                        }`}
                      >
                        {projectNames[id] || `Project #${id}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================= Content Section ======================= */}
        {/* 1. TreeMap */}
        <div
          className="rounded-[40px] p-2 shadow-inner border border-white/50 mb-12 relative overflow-hidden bg-white/30 
                     h-[1000px] md:h-[700px]"
        >
          {isLoadingHistory && (
            <div className="absolute inset-0 z-50 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center rounded-[32px] transition-all">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <div className="text-lg font-bold text-gray-600 animate-pulse">
                Traveling to {selectedDate}...
              </div>
            </div>
          )}

          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-[0.15] grayscale">
            <img
              src="/logo.png"
              alt="COMPANY WATERMARK"
              className="w-[500px] h-auto object-contain mix-blend-multiply"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-[32px]" />

          <div className="w-full h-full relative z-10">
            {treemapVisualData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <Treemap
                  data={treemapVisualData}
                  dataKey="value"
                  aspectRatio={1}
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                  content={<CustomTreemapContent totalScore={totalScore} />}
                >
                  <Tooltip content={<CustomTooltip />} cursor={false} />
                </Treemap>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <p className="font-medium text-lg">
                  No Data Available ({lookback}d)
                </p>
                <p className="text-sm">
                  {projectNames[selectedGroupId]} ({selectedDate})
                </p>
                {!currentApiData && lookback !== 30 && (
                  <p className="text-xs text-red-400 mt-2">
                    Old data supports only 30d view.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 2. [Updated] Compact Leaderboard */}
        <div className="bg-white rounded-[32px] p-6 md:p-8 shadow-xl shadow-gray-200/50 border border-white mb-12">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            🏆 Leaderboard
            <span className="text-xs md:text-sm font-normal text-gray-400 bg-gray-50 px-2 py-1 rounded ml-2">
              Top 50 ({lookback}d)
            </span>
          </h2>

          <div className="overflow-hidden border border-gray-100 rounded-2xl">
            {/* overflow-x-auto를 유지하되, 컨텐츠가 화면에 맞도록 max-width 설정 */}
            <div className="w-full">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-500 text-[10px] md:text-xs uppercase tracking-wider border-b border-gray-100">
                    <th className="px-2 py-3 md:px-6 md:py-4 font-semibold w-8 md:w-16 text-center">
                      #
                    </th>
                    <th className="px-2 py-3 md:px-6 md:py-4 font-semibold w-auto">
                      Channel
                    </th>
                    <th className="px-2 py-3 md:px-6 md:py-4 font-semibold text-right w-20 md:w-32">
                      Score
                    </th>
                    <th className="px-2 py-3 md:px-6 md:py-4 font-semibold text-center w-12 md:w-24">
                      Link
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {rankingData.length > 0 ? (
                    rankingData.map((item, index) => {
                      const channel = item.itemData as ChannelData;
                      const telegramLink = channel.channelUsername
                        ? `https://t.me/${channel.channelUsername}`
                        : `https://t.me/${channel.channelId}`;

                      return (
                        <tr
                          key={channel.channelId}
                          className="hover:bg-gray-50/80 transition-colors group"
                        >
                          {/* Rank */}
                          <td className="px-2 py-2 md:px-6 md:py-3 text-center font-bold text-gray-400 text-xs md:text-sm group-hover:text-indigo-500 transition-colors">
                            {index + 1}
                          </td>

                          {/* Channel Info (Compact) */}
                          <td className="px-2 py-2 md:px-6 md:py-3 overflow-hidden">
                            <div className="flex items-center gap-2 md:gap-4">
                              {channel.profileImageUrl ? (
                                <img
                                  src={channel.profileImageUrl}
                                  alt=""
                                  className="w-6 h-6 md:w-10 md:h-10 rounded-full shadow-sm object-cover border border-gray-100 shrink-0"
                                />
                              ) : (
                                <div className="w-6 h-6 md:w-10 md:h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-[10px] font-bold shrink-0">
                                  ?
                                </div>
                              )}
                              <div className="min-w-0 flex flex-col">
                                <p className="font-bold text-gray-900 text-xs md:text-sm truncate pr-2">
                                  {channel.channelTitle}
                                </p>
                                <p className="text-[10px] md:text-xs text-gray-400 truncate">
                                  {channel.channelUsername
                                    ? `@${channel.channelUsername}`
                                    : `@${channel.channelId}`}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Score (Compact) */}
                          <td className="px-2 py-2 md:px-6 md:py-3 text-right">
                            <span className="font-bold text-gray-900 bg-gray-50 px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg tabular-nums text-xs md:text-sm whitespace-nowrap">
                              {Math.round(channel.score).toLocaleString()}
                            </span>
                          </td>

                          {/* Link Button (Compact) */}
                          <td className="px-2 py-2 md:px-6 md:py-3 text-center">
                            <a
                              href={telegramLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center w-7 h-7 md:w-8 md:h-8 rounded-full bg-gray-100 text-gray-400 hover:bg-sky-50 hover:text-sky-600 transition-all hover:scale-110"
                              title="Visit Telegram Channel"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="w-3 h-3 md:w-4 md:h-4"
                              >
                                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                              </svg>
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-12 text-center text-gray-400"
                      >
                        No ranking data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. Schedule Section */}
        <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-gray-200/50 border border-white min-h-[500px]">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 flex items-center gap-3">
            🗓️ All Content Schedules
            <span className="text-sm font-normal text-gray-400 bg-gray-50 px-2 py-1 rounded ml-2">
              Live Status
            </span>
          </h2>

          <div className="relative border border-gray-100 bg-gray-50/50 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[1000px] p-6 pt-12 relative min-h-[400px]">
                {/* Date Headers */}
                <div className="absolute inset-0 pointer-events-none">
                  {dateHeaders.map((h, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-gray-200/60 border-dashed text-[10px] text-gray-400 pl-2 pt-2"
                      style={{ left: `${h.left}%` }}
                    >
                      {h.label}
                    </div>
                  ))}
                </div>

                {/* Tasks Bars */}
                <div className="space-y-4 relative z-10 mt-2">
                  {notionTasks.length > 0 ? (
                    notionTasks.map((task) => {
                      const left = getDatePosition(task.dateStart);
                      const width = Math.max(
                        getDurationWidth(task.dateStart, task.dateEnd),
                        5
                      );

                      return (
                        <div key={task.id} className="relative h-10 group">
                          <div
                            className={`absolute h-9 rounded-xl shadow-sm border px-3 flex items-center gap-3 text-xs font-semibold transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer
                            ${
                              task.status === "Done" || task.status === "완료"
                                ? "bg-gray-100 text-gray-400 border-gray-200"
                                : task.status === "In Progress" ||
                                  task.status === "진행중"
                                ? "bg-blue-50 text-blue-700 border-blue-100"
                                : "bg-white text-gray-700 border-gray-200"
                            }`}
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              minWidth: "180px",
                            }}
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 shadow-sm ${
                                task.category === "Video"
                                  ? "bg-red-500"
                                  : task.category === "Article"
                                  ? "bg-orange-500"
                                  : "bg-gray-400"
                              }`}
                            />
                            <span className="truncate flex-1 font-bold">
                              {task.title}
                            </span>
                            {task.managerImg && (
                              <img
                                src={task.managerImg}
                                alt=""
                                className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-24 text-gray-400">
                      No active content schedules found.
                    </div>
                  )}
                </div>

                {/* Today Marker */}
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-red-500/80 z-20 pointer-events-none"
                  // [Fix] Here is the key change: use initialDateObj instead of new Date()
                  style={{
                    left: `${getDatePosition(initialDateObj.toISOString())}%`,
                  }}
                >
                  <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full absolute -top-1.5 -left-6 shadow-md">
                    Today
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
