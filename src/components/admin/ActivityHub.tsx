"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@supabase/supabase-js";
import {
  MessageSquare,
  Bell,
  Send,
  X,
  CalendarCheck,
  Sparkles,
  PackageSearch,
  Landmark,
  Clock,
  Building2,
  UtensilsCrossed,
  Star,
  Info,
  Bot,
  Users,
  Circle,
  Volume2,
  VolumeX,
  ArrowLeft,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Message {
  id: string;
  content: string;
  sender_id: string | null;
  sender_name: string;
  type: "user" | "system";
  category: string;
  metadata: Record<string, unknown>;
  recipient_id: string | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  role_id: number;
  is_online: boolean;
}

interface ConversationPreview {
  partner_id: string;
  partner_name: string;
  last_message: string;
  last_time: string;
  is_online: boolean;
}

const ROLE_LABELS: Record<number, string> = {
  1: "Developer",
  2: "Manager",
  3: "Staff",
  4: "Housekeeping",
  5: "Admin",
};

const CATEGORY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  booking: { icon: CalendarCheck, color: "text-blue-400", label: "Booking" },
  housekeeping: { icon: Sparkles, color: "text-purple-400", label: "Housekeeping" },
  inventory: { icon: PackageSearch, color: "text-amber-400", label: "Inventory" },
  treasury: { icon: Landmark, color: "text-emerald-400", label: "Treasury" },
  shift: { icon: Clock, color: "text-cyan-400", label: "Shift" },
  receivable: { icon: Building2, color: "text-rose-400", label: "Receivable" },
  restaurant: { icon: UtensilsCrossed, color: "text-orange-400", label: "Restaurant" },
  review: { icon: Star, color: "text-yellow-400", label: "Review" },
  general: { icon: Info, color: "text-slate-400", label: "General" },
  chat: { icon: MessageSquare, color: "text-indigo-400", label: "Chat" },
};

/* ------------------------------------------------------------------ */
/*  Sound                                                              */
/* ------------------------------------------------------------------ */

let audioCtx: AudioContext | null = null;

function playNotificationSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(660, now + 0.15);
    gain2.gain.setValueAtTime(0.12, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.5);
  } catch {
    // silent
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (a + b).toUpperCase();
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function authHeaders() {
  const token = localStorage.getItem("admin_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* ================================================================== */
/*  Main Component                                                     */
/* ================================================================== */

type TabKey = "all" | "chat" | "system" | "team";

export default function ActivityHub({
  currentAdminId,
  permissions = [],
}: {
  currentAdminId?: string;
  permissions?: string[];
}) {
  const canRead = permissions.includes("activity_hub.read");
  const canWrite = permissions.includes("activity_hub.write");

  /* ── Core state ── */
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("all");

  /* ── Broadcast (All tab) ── */
  const [broadcastMsgs, setBroadcastMsgs] = useState<Message[]>([]);
  const [broadcastLoaded, setBroadcastLoaded] = useState(false);

  /* ── DM state (Chat tab) ── */
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [convoLoaded, setConvoLoaded] = useState(false);
  const [activeDmPartner, setActiveDmPartner] = useState<{ id: string; name: string } | null>(null);
  const [dmMessages, setDmMessages] = useState<Message[]>([]);
  const [dmLoaded, setDmLoaded] = useState(false);

  /* ── Team state ── */
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLoaded, setTeamLoaded] = useState(false);

  /* ── UI state ── */
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  const soundEnabledRef = useRef(soundEnabled);
  const activeDmPartnerRef = useRef(activeDmPartner);
  const tabRef = useRef(tab);

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);
  useEffect(() => { activeDmPartnerRef.current = activeDmPartner; }, [activeDmPartner]);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // Unlock AudioContext on first user interaction
  useEffect(() => {
    const initAudio = () => {
      try {
        if (!audioCtx) {
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        } else if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }
      } catch (err) {
        // silent
      }
      document.removeEventListener("click", initAudio);
      document.removeEventListener("touchstart", initAudio);
    };

    document.addEventListener("click", initAudio);
    document.addEventListener("touchstart", initAudio);

    return () => {
      document.removeEventListener("click", initAudio);
      document.removeEventListener("touchstart", initAudio);
    };
  }, []);

  // Sound preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("activity_hub_sound");
      if (saved === "false") setSoundEnabled(false);
    } catch { /* silent */ }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem("activity_hub_sound", String(next)); } catch { /* silent */ }
      return next;
    });
  }, []);

  const supabase = useMemo(() => {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
  }, []);

  /* ================================================================ */
  /*  Data Fetching                                                    */
  /* ================================================================ */

  // ── Broadcast messages (All tab) ──
  const fetchBroadcast = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/messages?mode=broadcast&limit=100", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setBroadcastMsgs(data.messages ?? []);
        setBroadcastLoaded(true);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchBroadcast(); }, [fetchBroadcast]);

  // ── Team members ──
  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/team", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTeamMembers(data.members ?? []);
        setTeamLoaded(true);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchTeam();
    const interval = setInterval(fetchTeam, 30_000);
    return () => clearInterval(interval);
  }, [fetchTeam]);

  // ── DM conversation list ──
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/messages?mode=conversations", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const convos: ConversationPreview[] = (data.conversations ?? []).map((msg: Message) => {
          const partnerId =
            msg.sender_id === currentAdminId ? msg.recipient_id : msg.sender_id;
          const partnerName =
            msg.sender_id === currentAdminId
              ? "(Unknown)" // We'll resolve from team list
              : msg.sender_name;
          return {
            partner_id: partnerId ?? "",
            partner_name: partnerName,
            last_message: msg.content,
            last_time: msg.created_at,
            is_online: false,
          };
        });
        setConversations(convos);
        setConvoLoaded(true);
      }
    } catch { /* silent */ }
  }, [currentAdminId]);

  // Refresh conversations when Chat tab is active
  useEffect(() => {
    if (tab === "chat" && !activeDmPartner) {
      fetchConversations();
    }
  }, [tab, activeDmPartner, fetchConversations]);

  // ── DM thread with a specific partner ──
  const fetchDmThread = useCallback(async (partnerId: string) => {
    setDmLoaded(false);
    try {
      const res = await fetch(
        `/api/admin/messages?mode=dm&partner_id=${partnerId}&limit=100`,
        { headers: authHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        setDmMessages(data.messages ?? []);
        setDmLoaded(true);
      }
    } catch { /* silent */ }
  }, []);

  // Fetch thread when activeDmPartner changes
  useEffect(() => {
    if (activeDmPartner) {
      fetchDmThread(activeDmPartner.id);
    }
  }, [activeDmPartner, fetchDmThread]);

  // Resolve conversation partner names from team members
  const resolvedConversations = useMemo(() => {
    return conversations.map((c) => {
      const teamMember = teamMembers.find((m) => m.id === c.partner_id);
      return {
        ...c,
        partner_name: teamMember?.name ?? c.partner_name,
        is_online: teamMember?.is_online ?? false,
      };
    });
  }, [conversations, teamMembers]);

  /* ================================================================ */
  /*  Realtime                                                         */
  /* ================================================================ */

  useEffect(() => {
    const channel = supabase
      .channel("admin_messages_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_messages" },
        (payload) => {
          const msg = payload.new as Message;
          const isMyMessage = msg.sender_id === currentAdminId;

          if (!msg.recipient_id) {
            // ── Broadcast message → All tab ──
            setBroadcastMsgs((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          } else {
            // ── DM message → only if I'm sender or recipient ──
            const isForMe = msg.recipient_id === currentAdminId || msg.sender_id === currentAdminId;
            if (!isForMe) return; // Ignore DMs that aren't mine

            // If currently viewing this conversation, append in real-time
            const partnerId = activeDmPartnerRef.current?.id;
            const dmPartnerId = isMyMessage ? msg.recipient_id : msg.sender_id;
            if (partnerId && dmPartnerId === partnerId) {
              setDmMessages((prev) => {
                if (prev.some((m) => m.id === msg.id)) return prev;
                return [...prev, msg];
              });
            }

            // Refresh conversation list
            if (tabRef.current === "chat" && !activeDmPartnerRef.current) {
              fetchConversations();
            }
          }

          // Unread count if drawer closed
          if (!openRef.current) {
            setUnreadCount((c) => c + 1);
          }

          // Sound for messages from others
          if (soundEnabledRef.current && !isMyMessage) {
            // Only play if the message is relevant (broadcast or DM for me)
            if (!msg.recipient_id || msg.recipient_id === currentAdminId) {
              playNotificationSound();
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, currentAdminId, fetchConversations]);

  /* ================================================================ */
  /*  UI Helpers                                                       */
  /* ================================================================ */

  useLayoutEffect(() => {
    if (scrollRef.current && open) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [broadcastMsgs, dmMessages, open, tab, activeDmPartner]);

  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [open]);

  // Open a DM conversation
  const openDm = useCallback((partnerId: string, partnerName: string) => {
    setActiveDmPartner({ id: partnerId, name: partnerName });
    setTab("chat");
    setDraft("");
  }, []);

  // Go back to conversation list
  const closeDm = useCallback(() => {
    setActiveDmPartner(null);
    setDmMessages([]);
    fetchConversations();
  }, [fetchConversations]);

  // Send message
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const body: Record<string, string> = { content: text };
      if (activeDmPartner) {
        body.recipient_id = activeDmPartner.id;
      }
      await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      setDraft("");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [draft, sending, activeDmPartner]);

  const onlineCount = useMemo(() => teamMembers.filter((m) => m.is_online).length, [teamMembers]);
  const onlineMembers = useMemo(() => teamMembers.filter((m) => m.is_online), [teamMembers]);

  // Messages to display based on current view
  const displayMessages = tab === "all" ? broadcastMsgs :
    tab === "system" ? broadcastMsgs.filter((m) => m.type === "system") :
      dmMessages;

  const isLoaded = tab === "all" ? broadcastLoaded :
    tab === "system" ? broadcastLoaded :
      dmLoaded;

  // Check if input should show
  const showInput = canWrite && (tab === "all" || (tab === "chat" && activeDmPartner !== null));

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  if (!canRead) return null;

  return (
    <>
      {/* ── Floating action button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-300",
          "bg-[#07008A] text-white hover:scale-105 active:scale-95",
          "bottom-5 right-5 h-14 w-14",
          "tablet:bottom-6 tablet:right-6",
          open && "rotate-90 bg-red-500 hover:bg-red-600"
        )}
        aria-label={open ? "Close Activity Hub" : "Open Activity Hub"}
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : (
          <>
            <MessageSquare className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-in zoom-in-75 fade-in duration-200 ring-2 ring-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 tablet:bg-black/20"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Drawer ── */}
      <div
        className={cn(
          "fixed z-50 flex flex-col bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300 ease-out",
          "inset-x-0 bottom-0 h-[85vh] rounded-t-2xl",
          "tablet:inset-x-auto tablet:right-0 tablet:top-0 tablet:bottom-0 tablet:h-full tablet:w-[400px] tablet:rounded-none tablet:rounded-l-2xl",
          open
            ? "translate-y-0 tablet:translate-x-0"
            : "translate-y-full tablet:translate-y-0 tablet:translate-x-full"
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            {/* Back button for DM thread */}
            {tab === "chat" && activeDmPartner && (
              <button
                onClick={closeDm}
                className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-slate-500" />
              </button>
            )}
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                {tab === "chat" && activeDmPartner ? activeDmPartner.name : "Activity Hub"}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {tab === "chat" && activeDmPartner
                  ? (() => {
                      const partner = teamMembers.find((m) => m.id === activeDmPartner.id);
                      return partner?.is_online ? "Online" : "Offline";
                    })()
                  : "Team chat & system alerts"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleSound}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={soundEnabled ? "Mute notifications" : "Unmute notifications"}
              title={soundEnabled ? "Sound on" : "Sound off"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-slate-500" />
              ) : (
                <VolumeX className="h-4 w-4 text-slate-400" />
              )}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* ── Tabs (hidden when inside a DM thread) ── */}
        {!(tab === "chat" && activeDmPartner) && (
          <div className="flex border-b border-slate-200 dark:border-slate-700/60 px-3 shrink-0">
            {([
              { key: "all" as TabKey, label: "All", icon: MessageSquare },
              { key: "chat" as TabKey, label: "Chat", icon: Inbox },
              { key: "system" as TabKey, label: "Alerts", icon: Bell },
              { key: "team" as TabKey, label: "Team", icon: Users, badge: onlineCount },
            ]).map(({ key, label, icon: Icon, badge }) => (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  if (key !== "chat") setActiveDmPartner(null);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors border-b-2 -mb-px",
                  tab === key
                    ? "border-[#07008A] text-[#07008A] dark:border-[#FED501] dark:text-[#FED501]"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {badge !== undefined && badge > 0 && (
                  <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-bold leading-none">
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════ */}
        {/*  TEAM TAB                                                */}
        {/* ════════════════════════════════════════════════════════ */}
        {tab === "team" ? (
          <div className="flex-1 overflow-y-auto modal-scrollbar">
            {!teamLoaded ? (
              <Spinner />
            ) : (
              <div className="py-2">
                <div className="mx-4 mt-2 mb-3 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-300 leading-snug">
                    <span className="font-semibold">Private Chat</span> — Tap any member to start a private conversation.
                  </p>
                </div>

                {onlineMembers.length > 0 && (
                  <div className="px-5 pt-3 pb-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                      Online — {onlineCount}
                    </p>
                  </div>
                )}
                {teamMembers
                  .filter((m) => m.is_online && m.id !== currentAdminId)
                  .map((member) => (
                    <TeamMemberRow
                      key={member.id}
                      member={member}
                      onTap={() => openDm(member.id, member.name)}
                    />
                  ))}

                {teamMembers.some((m) => !m.is_online && m.id !== currentAdminId) && (
                  <div className="px-5 pt-4 pb-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                      <Circle className="h-2 w-2 fill-slate-300 text-slate-300 dark:fill-slate-600 dark:text-slate-600" />
                      Offline — {teamMembers.filter((m) => !m.is_online && m.id !== currentAdminId).length}
                    </p>
                  </div>
                )}
                {teamMembers
                  .filter((m) => !m.is_online && m.id !== currentAdminId)
                  .map((member) => (
                    <TeamMemberRow
                      key={member.id}
                      member={member}
                      onTap={() => openDm(member.id, member.name)}
                    />
                  ))}
              </div>
            )}
          </div>

        /* ════════════════════════════════════════════════════════ */
        /*  CHAT TAB — Conversation list OR DM thread               */
        /* ════════════════════════════════════════════════════════ */
        ) : tab === "chat" && !activeDmPartner ? (
          <div className="flex-1 overflow-y-auto modal-scrollbar">
            {!convoLoaded ? (
              <Spinner />
            ) : resolvedConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 gap-3 px-6">
                <Inbox className="h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs text-center leading-relaxed">
                  Go to the <span className="font-semibold">Team</span> tab and tap a member to start a private chat.
                </p>
              </div>
            ) : (
              <div className="py-1">
                {resolvedConversations.map((convo) => (
                  <button
                    key={convo.partner_id}
                    type="button"
                    onClick={() => openDm(convo.partner_id, convo.partner_name)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs font-bold">
                        {getInitials(convo.partner_name)}
                      </div>
                      {convo.is_online && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {convo.partner_name}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                          {fmtTime(convo.last_time)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {convo.last_message}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

        /* ════════════════════════════════════════════════════════ */
        /*  ALL / ALERTS / DM THREAD — Message list view            */
        /* ════════════════════════════════════════════════════════ */
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Online members strip (All tab only) */}
            {tab === "all" && teamMembers.length > 0 && (
              <div className="shrink-0 px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-2">
                  <div className="flex items-center -space-x-1.5 shrink-0">
                    {onlineMembers.slice(0, 6).map((m) => (
                      <div
                        key={m.id}
                        className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-[8px] font-bold border-2 border-white dark:border-slate-900 shrink-0"
                        title={m.name}
                      >
                        {getInitials(m.name)}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{onlineCount} online</span>
                    <span className="mx-1">·</span>
                    <span>{teamMembers.length} members</span>
                    <span className="mx-1">·</span>
                    <span className="text-slate-400 dark:text-slate-500">Group Channel</span>
                  </p>
                </div>
              </div>
            )}

            {/* Messages list */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-1 modal-scrollbar"
            >
              {!isLoaded && <Spinner />}

              {isLoaded && displayMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 gap-3 px-6">
                  {tab === "system" ? (
                    <>
                      <Bell className="h-10 w-10 opacity-30" />
                      <p className="text-sm font-medium">No alerts yet</p>
                      <p className="text-xs text-center leading-relaxed">
                        System alerts for bookings, housekeeping, inventory &amp; shifts will appear here automatically.
                      </p>
                    </>
                  ) : tab === "chat" && activeDmPartner ? (
                    <>
                      <MessageSquare className="h-10 w-10 opacity-30" />
                      <p className="text-sm font-medium">Start the conversation</p>
                      <p className="text-xs text-center leading-relaxed">
                        Send a private message to <span className="font-semibold">{activeDmPartner.name}</span>.
                        Only the two of you will see this conversation.
                      </p>
                    </>
                  ) : (
                    <>
                      <Users className="h-10 w-10 opacity-30" />
                      <p className="text-sm font-medium">Group Channel</p>
                      <p className="text-xs text-center leading-relaxed">
                        This is a shared conversation for all staff.
                        Type a message below — everyone on the team will see it.
                      </p>
                    </>
                  )}
                </div>
              )}

              {displayMessages.map((msg, i) => {
                const isMe = msg.sender_id === currentAdminId;
                const isSystem = msg.type === "system";
                const catMeta = CATEGORY_META[msg.category] ?? CATEGORY_META.general;
                const CatIcon = catMeta.icon;

                const prevMsg = i > 0 ? displayMessages[i - 1] : null;
                const msgDate = new Date(msg.created_at).toDateString();
                const prevDate = prevMsg ? new Date(prevMsg.created_at).toDateString() : null;
                const showDateSep = msgDate !== prevDate;

                return (
                  <div key={msg.id}>
                    {showDateSep && (
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                          {new Date(msg.created_at).toLocaleDateString([], {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                      </div>
                    )}

                    {isSystem ? (
                      <div className="flex items-start gap-2.5 py-1.5 group/msg">
                        <div className="mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800">
                          <Bot className={cn("h-4 w-4", catMeta.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <CatIcon className={cn("h-3 w-3", catMeta.color)} />
                            <span className={cn("text-[10px] font-bold uppercase tracking-wider", catMeta.color)}>
                              {catMeta.label}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto opacity-0 group-hover/msg:opacity-100 transition-opacity">
                              {fmtTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-snug bg-slate-50 dark:bg-slate-800/60 rounded-lg rounded-tl-sm px-3 py-2 border border-slate-100 dark:border-slate-700/40">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    ) : isMe ? (
                      <div className="flex justify-end py-1 group/msg">
                        <div className="max-w-[80%]">
                          <div className="flex items-center justify-end gap-1.5 mb-0.5">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                              {fmtTime(msg.created_at)}
                            </span>
                            <span className="text-[10px] font-semibold text-[#07008A] dark:text-[#FED501]">
                              You
                            </span>
                          </div>
                          <p className="text-[13px] text-white leading-snug bg-[#07008A] rounded-lg rounded-br-sm px-3 py-2">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2.5 py-1 group/msg">
                        <div className="mt-0.5 h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold">
                            {getInitials(msg.sender_name)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 max-w-[80%]">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                              {msg.sender_name}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                              {fmtTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-[13px] text-slate-800 dark:text-slate-200 leading-snug bg-slate-100 dark:bg-slate-800 rounded-lg rounded-tl-sm px-3 py-2">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Input bar ── */}
        {showInput && (
          <div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900">
            {tab === "chat" && activeDmPartner && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Private message to <span className="font-semibold">{activeDmPartner.name}</span>
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  activeDmPartner
                    ? `Message ${activeDmPartner.name}…`
                    : "Message everyone…"
                }
                maxLength={2000}
                className="flex-1 h-10 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#07008A]/30 dark:focus:ring-[#FED501]/30 transition-shadow"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center transition-all shrink-0",
                  draft.trim()
                    ? "bg-[#07008A] text-white hover:bg-[#07008A]/90 active:scale-95"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="h-6 w-6 border-2 border-[#07008A] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function TeamMemberRow({
  member,
  onTap,
}: {
  member: TeamMember;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={cn(
        "w-full flex items-center gap-3 px-5 py-2.5 transition-colors text-left",
        member.is_online
          ? "hover:bg-slate-50 dark:hover:bg-slate-800/50"
          : "opacity-60 hover:opacity-80"
      )}
    >
      <div className="relative shrink-0">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold",
            member.is_online
              ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300"
              : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
          )}
        >
          {getInitials(member.name)}
        </div>
        {member.is_online && (
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
          {member.name}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {ROLE_LABELS[member.role_id] || "Staff"}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-1.5">
        <span
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full",
            member.is_online
              ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30"
              : "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800"
          )}
        >
          {member.is_online ? "Online" : "Offline"}
        </span>
        <MessageSquare className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
      </div>
    </button>
  );
}
