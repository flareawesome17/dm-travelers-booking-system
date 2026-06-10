"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  ThumbsUp,
  Heart,
  CornerUpLeft,
  CheckCheck,
  SmilePlus,
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
  metadata?: {
    room_id?: string;
    status?: string;
    payment_method?: string;
    reference?: string;
    amount?: number;
    read_by?: string[];
    reactions?: Record<string, string>;
    reply_to?: {
      id: string;
      content: string;
      sender: string;
    };
    [key: string]: any;
  };
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
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; sender: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [msgToDelete, setMsgToDelete] = useState<string | null>(null);
  const [activeActionsId, setActiveActionsId] = useState<string | null>(null);

  const adminRole = useMemo(() => {
    return teamMembers.find((m) => m.id === currentAdminId)?.role_id || null;
  }, [teamMembers, currentAdminId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const openRef = useRef(open);
  const soundEnabledRef = useRef(soundEnabled);
  const activeDmPartnerRef = useRef(activeDmPartner);
  const tabRef = useRef(tab);
  const broadcastInitializedRef = useRef(false);
  const conversationsInitializedRef = useRef(false);
  const conversationLatestRef = useRef<Message[]>([]);

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

  // Notification setup
  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }, []);

  const showNotification = useCallback((msg: Message) => {
    if (notificationPermission !== "granted" || document.hasFocus()) return;
    try {
      const n = new Notification(msg.sender_name || "New Message", {
        body: msg.content,
        icon: "/favicon.ico",
        tag: msg.recipient_id ? "dm" : "broadcast",
      });
      n.onclick = () => {
        window.focus();
        setOpen(true);
        if (msg.recipient_id) setTab("chat");
        n.close();
      };
    } catch { /* silent */ }
  }, [notificationPermission]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try { localStorage.setItem("activity_hub_sound", String(next)); } catch { /* silent */ }
      return next;
    });
  }, []);

  /* ================================================================ */
  /*  Data Fetching                                                    */
  /* ================================================================ */

  // ── Broadcast messages (All tab) ──
  const notifyIncomingMessages = useCallback((previous: Message[], next: Message[]) => {
    const previousIds = new Set(previous.map((message) => message.id));
    const incoming = next.filter(
      (message) =>
        !previousIds.has(message.id) &&
        message.sender_id !== currentAdminId &&
        (!message.recipient_id || message.recipient_id === currentAdminId),
    );

    if (incoming.length === 0) return;
    if (!openRef.current) {
      setUnreadCount((count) => count + incoming.length);
    }
    if (soundEnabledRef.current) {
      playNotificationSound();
      for (const message of incoming) {
        showNotification(message);
      }
    }
  }, [currentAdminId, showNotification]);

  const fetchBroadcast = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/messages?mode=broadcast&limit=100", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const nextMessages: Message[] = data.messages ?? [];
        setBroadcastMsgs((previous) => {
          if (broadcastInitializedRef.current) {
            notifyIncomingMessages(previous, nextMessages);
          }
          broadcastInitializedRef.current = true;
          return nextMessages;
        });
        setBroadcastLoaded(true);
      }
    } catch { /* silent */ }
  }, [notifyIncomingMessages]);

  useEffect(() => {
    if (canRead) fetchBroadcast();
  }, [canRead, fetchBroadcast]);

  // ── Team members ──
  const fetchTeam = useCallback(async () => {
    try {
      if (document.visibilityState === "hidden") return;
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
    const interval = setInterval(fetchTeam, 120_000);
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
        const latestMessages: Message[] = data.conversations ?? [];
        if (conversationsInitializedRef.current) {
          notifyIncomingMessages(conversationLatestRef.current, latestMessages);
        }
        conversationsInitializedRef.current = true;
        conversationLatestRef.current = latestMessages;

        const convos: ConversationPreview[] = latestMessages.map((msg: Message) => {
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
  }, [currentAdminId, notifyIncomingMessages]);

  // Refresh conversations when Chat tab is active
  useEffect(() => {
    if (tab === "chat" && !activeDmPartner) {
      fetchConversations();
    }
  }, [tab, activeDmPartner, fetchConversations]);

  // ── DM thread with a specific partner ──
  const fetchDmThread = useCallback(async (partnerId: string, background = false) => {
    if (!background) setDmLoaded(false);
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

  // Seen mechanism: When messages change, mark them as read
  useEffect(() => {
    if (!openRef.current || !currentAdminId) return;

    const messagesToMark = dmMessages.filter(
      (m) =>
        m.sender_id !== currentAdminId && // not mine
        m.recipient_id === currentAdminId && // meant for me
        (!m.metadata?.read_by || !m.metadata.read_by.includes(currentAdminId))
    );

    if (tab === "all") {
      messagesToMark.push(
        ...broadcastMsgs.filter(
          (m) =>
            m.sender_id !== currentAdminId &&
            (!m.metadata?.read_by || !m.metadata.read_by.includes(currentAdminId))
        )
      );
    }

    if (messagesToMark.length > 0) {
      messagesToMark.forEach((msg) => {
        fetch(`/api/admin/messages/${msg.id}/metadata`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ action: "mark_read" }),
        }).catch(() => {});
      });
      // Speculatively add locally to avoid double-firing
      const addRead = (msgs: Message[]) =>
        msgs.map((m) => {
          if (messagesToMark.some((target) => target.id === m.id)) {
            return {
              ...m,
              metadata: {
                ...m.metadata,
                read_by: [...(m.metadata?.read_by || []), currentAdminId],
              },
            };
          }
          return m;
        });
      if (tab === "chat") setDmMessages(addRead);
      if (tab === "all") setBroadcastMsgs(addRead);
    }
  }, [dmMessages, broadcastMsgs, open, tab, currentAdminId]);

  /* ================================================================ */
  /*  Realtime                                                         */
  /* ================================================================ */

  useEffect(() => {
    const handlePayload = (payload: any) => {
      const msg = payload.new as Message;
      const isMyMessage = msg.sender_id === currentAdminId;
      const isInsert = payload.eventType === "INSERT";

      if (!msg.recipient_id) {
        // ── Broadcast message → All tab ──
        setBroadcastMsgs((prev) => {
          if (isInsert && prev.some((m) => m.id === msg.id)) return prev;
          if (!isInsert) return prev.map((m) => (m.id === msg.id ? msg : m));
          return [...prev, msg];
        });
      } else {
        // ── DM message → only if I'm sender or recipient ──
        const isForMe = msg.recipient_id === currentAdminId || msg.sender_id === currentAdminId;
        if (!isForMe) return;

        const partnerId = activeDmPartnerRef.current?.id;
        const dmPartnerId = isMyMessage ? msg.recipient_id : msg.sender_id;
        if (partnerId && dmPartnerId === partnerId) {
          setDmMessages((prev) => {
            if (isInsert && prev.some((m) => m.id === msg.id)) return prev;
            if (!isInsert) return prev.map((m) => (m.id === msg.id ? msg : m));
            return [...prev, msg];
          });
        }

        if (isInsert && tabRef.current === "chat" && !activeDmPartnerRef.current) {
          fetchConversations();
        }
      }

      if (isInsert) {
        if (!openRef.current) {
          setUnreadCount((c) => c + 1);
        }
        if (soundEnabledRef.current && !isMyMessage) {
          if (!msg.recipient_id || msg.recipient_id === currentAdminId) {
            playNotificationSound();
            showNotification(msg);
          }
        }
      }
    };

    const handleUpdate = (payload: any) => {
      const msg = payload.new as Message;
      const setter = msg.recipient_id ? setDmMessages : setBroadcastMsgs;
      setter((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    };

    const handleDelete = (payload: any) => {
      const id = payload.old.id;
      setBroadcastMsgs((prev) => prev.filter((m) => m.id !== id));
      setDmMessages((prev) => prev.filter((m) => m.id !== id));
    };

    if (!canRead) return undefined;

    const pollMessages = () => {
      if (document.visibilityState === "hidden") return;
      fetchBroadcast();
      fetchConversations();
      const activePartner = activeDmPartnerRef.current;
      if (activePartner) {
        fetchDmThread(activePartner.id, true);
      }
    };

    const interval = window.setInterval(pollMessages, 10_000);
    document.addEventListener("visibilitychange", pollMessages);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", pollMessages);
    };
  }, [canRead, currentAdminId, fetchBroadcast, fetchConversations, fetchDmThread, showNotification]);

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
    setReplyTo(null);
    setDraft("");
    fetchConversations();
  }, [fetchConversations]);

  // Send message
  const handleSend = useCallback(async (overrideText?: string) => {
    const text = overrideText ?? draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const body: Record<string, string | object> = { content: text };
      if (activeDmPartner) {
        body.recipient_id = activeDmPartner.id;
      }
      if (replyTo) {
        body.reply_to = replyTo;
      }
      const response = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        fetchBroadcast();
        fetchConversations();
        if (activeDmPartner) {
          fetchDmThread(activeDmPartner.id, true);
        }
      }
      if (overrideText === undefined) {
        setDraft("");
      }
      setReplyTo(null);
      if (inputRef.current) {
        inputRef.current.style.height = "auto"; // Reset height
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [activeDmPartner, draft, fetchBroadcast, fetchConversations, fetchDmThread, replyTo, sending]);

  // Mentions logic
  const filteredMentionMembers = useMemo(() => {
    if (mentionSearch === null) return [];
    const search = mentionSearch.toLowerCase();
    return teamMembers.filter((m) => m.name.toLowerCase().includes(search));
  }, [mentionSearch, teamMembers]);

  const insertMention = useCallback((member: TeamMember) => {
    if (mentionSearch === null) return;
    const before = draft.substring(0, draft.lastIndexOf("@", draft.length - (draft.length - draft.lastIndexOf("@"))));
    const after = draft.substring(draft.lastIndexOf("@") + mentionSearch.length + 1);
    const newDraft = `${before}@${member.name} ${after}`;
    setDraft(newDraft);
    setMentionSearch(null);
    inputRef.current?.focus();
  }, [draft, mentionSearch]);

  const handleUpdateMessage = useCallback(async (id: string, content: string) => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      const response = await fetch(`/api/admin/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ content }),
      });
      if (response.ok) {
        fetchBroadcast();
        fetchConversations();
        if (activeDmPartner) {
          fetchDmThread(activeDmPartner.id, true);
        }
      }
      setEditingId(null);
    } finally {
      setSending(false);
    }
  }, [activeDmPartner, fetchBroadcast, fetchConversations, fetchDmThread, sending]);

  const deleteMessage = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/admin/messages/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (response.ok) {
        fetchBroadcast();
        fetchConversations();
        if (activeDmPartner) {
          fetchDmThread(activeDmPartner.id, true);
        }
      }
      setMsgToDelete(null);
    } catch { /* silent */ }
  }, [activeDmPartner, fetchBroadcast, fetchConversations, fetchDmThread]);

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
            {notificationPermission === "default" && (
                <button
                  onClick={requestNotificationPermission}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Enable browser notifications"
                >
                  <Bell className="h-4 w-4 text-indigo-500" />
                </button>
            )}
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
              className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 space-y-1 modal-scrollbar"
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
                const prevMsg = i > 0 ? displayMessages[i - 1] : null;
                const msgDate = new Date(msg.created_at).toDateString();
                const prevDate = prevMsg ? new Date(prevMsg.created_at).toDateString() : null;
                const showDateSep = msgDate !== prevDate;
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMe={msg.sender_id === currentAdminId}
                    isSystem={msg.type === "system"}
                    currentAdminId={currentAdminId}
                    adminRole={adminRole}
                    teamMembers={teamMembers}
                    onReply={() =>
                      setReplyTo({
                        id: msg.id,
                        content: msg.content,
                        sender: msg.sender_name,
                      })
                    }
                    onEdit={(newContent) => handleUpdateMessage(msg.id, newContent)}
                    onDelete={() => setMsgToDelete(msg.id)}
                    showDateSep={showDateSep}
                    isActive={activeActionsId === msg.id}
                    onSetActive={() => setActiveActionsId(activeActionsId === msg.id ? null : msg.id)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── Mentions dropdown ── */}
        {mentionSearch !== null && filteredMentionMembers.length > 0 && (
          <div className="absolute bottom-[80px] left-4 right-4 z-[60] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in slide-in-from-bottom-2">
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mention Team Member</p>
            </div>
            <div className="max-h-[200px] overflow-y-auto modal-scrollbar">
              {filteredMentionMembers.map((member, i) => (
                <button
                  key={member.id}
                  onClick={() => insertMention(member)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors",
                    mentionIndex === i ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  )}
                >
                  <div className="h-6 w-6 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                    {getInitials(member.name)}
                  </div>
                  <span className="text-sm font-medium">{member.name}</span>
                  {member.is_online && <Circle className="h-1.5 w-1.5 fill-emerald-500 text-emerald-500 ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input bar ── */}
        {showInput && (
          <div className="shrink-0 px-4 py-3 border-t border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 flex flex-col gap-2">
            {replyTo && (
              <div className="flex items-start justify-between gap-2 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <CornerUpLeft className="h-3.5 w-3.5 mt-0.5 text-indigo-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      Replying to {replyTo.sender}
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                      {replyTo.content}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="p-1 text-slate-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {tab === "chat" && activeDmPartner && !replyTo && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Private message to <span className="font-semibold">{activeDmPartner.name}</span>
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) handleSend();
                else handleSend("👍");
              }}
              className="flex items-end gap-2 relative"
            >
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraft(val);
                  
                  // Mention detection
                  const cursor = e.target.selectionStart || 0;
                  const textBeforeCursor = val.substring(0, cursor);
                  const lastAt = textBeforeCursor.lastIndexOf("@");
                  if (lastAt !== -1 && !textBeforeCursor.substring(lastAt).includes(" ")) {
                     setMentionSearch(textBeforeCursor.substring(lastAt + 1));
                     setMentionIndex(0);
                  } else {
                     setMentionSearch(null);
                  }

                  if (val === "") {
                     e.target.style.height = "auto";
                  }
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto"; // reset to compute scroll
                  target.style.height = `${Math.min(target.scrollHeight, 100)}px`;
                }}
                onKeyDown={(e) => {
                  if (mentionSearch !== null && filteredMentionMembers.length > 0) {
                     if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setMentionIndex(i => (i + 1) % filteredMentionMembers.length);
                     } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setMentionIndex(i => (i - 1 + filteredMentionMembers.length) % filteredMentionMembers.length);
                     } else if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        insertMention(filteredMentionMembers[mentionIndex]);
                     } else if (e.key === "Escape") {
                        setMentionSearch(null);
                     }
                  } else if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (draft.trim()) handleSend();
                  }
                }}
                rows={1}
                placeholder={
                  activeDmPartner
                    ? `Message ${activeDmPartner.name}…`
                    : "Message everyone…"
                }
                className="flex-1 min-h-[40px] max-h-[100px] resize-none py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none custom-scrollbar"
              />
              <button
                type="submit"
                disabled={sending}
                className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center transition-all shrink-0",
                  draft.trim()
                    ? "bg-[#07008A] text-white hover:bg-[#07008A]/90 active:scale-95"
                    : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 hover:bg-indigo-200 active:scale-95"
                )}
              >
                {draft.trim() ? (
                  <Send className="h-4 w-4" />
                ) : (
                  <ThumbsUp className="h-5 w-5" />
                )}
              </button>
            </form>
          </div>
        )}
         {/* ── Deletion Confirmation ── */}
        <AlertDialog open={!!msgToDelete} onOpenChange={(open) => !open && setMsgToDelete(null)}>
          <AlertDialogContent className="max-w-[400px] rounded-2xl border-slate-200 dark:border-slate-700/60 p-6 shadow-2xl">
            <AlertDialogHeader>
              <div className="mx-auto w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-2">
                <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <AlertDialogTitle className="text-center text-xl font-bold text-slate-900 dark:text-white">Delete Message?</AlertDialogTitle>
              <AlertDialogDescription className="text-center text-slate-500 dark:text-slate-400">
                Are you sure you want to delete this message? This action will remove it for everyone in the chat and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col sm:flex-row gap-2 mt-4">
              <AlertDialogCancel className="w-full sm:flex-1 rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => msgToDelete && deleteMessage(msgToDelete)}
                className="w-full sm:flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-600/20 active:scale-95 transition-all"
              >
                Delete Message
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function MessageBubble({
  msg,
  isMe,
  isSystem,
  currentAdminId,
  adminRole,
  teamMembers,
  onReply,
  onEdit,
  onDelete,
  showDateSep,
  isActive,
  onSetActive,
}: {
  msg: Message;
  isMe: boolean;
  isSystem: boolean;
  currentAdminId?: string;
  adminRole: number | null;
  teamMembers: TeamMember[];
  onReply: () => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
  showDateSep: boolean;
  isActive: boolean;
  onSetActive: () => void;
}) {
  const [swiping, setSwiping] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [showReactions, setShowReactions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState(msg.content);

  // Sync editing state
  useEffect(() => {
    setIsEditing(false);
    setEditVal(msg.content);
  }, [msg.content]);

  const handleUpdateLocal = async () => {
    if (editVal.trim() === msg.content) {
      setIsEditing(false);
      return;
    }
    // We call the parent update but optimistically close
    setIsEditing(false);
    onEdit(editVal);
  };

  const startX = useRef(0);
  const startDrag = (e: React.TouchEvent | React.MouseEvent) => {
    if (isSystem) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    startX.current = clientX;
    setSwiping(true);
  };
  const onDrag = (e: React.TouchEvent | React.MouseEvent) => {
    if (!swiping || isSystem) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const delta = startX.current - clientX;
    // only allow swipe left
    if (delta > 0 && delta < 80) setSwipeX(-delta);
  };
  const endDrag = () => {
    if (swipeX < -40) {
      onReply();
    }
    setSwiping(false);
    setSwipeX(0);
  };

  const handleReact = (emoji: string) => {
    setShowReactions(false);
    fetch(`/api/admin/messages/${msg.id}/metadata`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ action: "react", reaction: emoji }),
    }).catch(() => {});
  };

  const catMeta = CATEGORY_META[msg.category] ?? CATEGORY_META.general;
  const CatIcon = catMeta.icon;

  const readByCount = msg.metadata?.read_by?.filter((u) => u !== msg.sender_id).length || 0;
  const reactionsMap = msg.metadata?.reactions || {};
  const reactionValues = Object.values(reactionsMap);
  const reactionCount = reactionValues.reduce((acc, curr) => {
    acc[curr] = (acc[curr] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="relative group">
      {showDateSep && (
        <div className="flex items-center gap-3 my-3">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-[10px] font-semibold text-slate-400 dark:bg-slate-500 uppercase tracking-wider">
            {new Date(msg.created_at).toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>
      )}

      {/* Swipe to reply background icon */}
      <div 
        className={cn(
          "absolute inset-y-0 right-4 flex items-center justify-center transition-opacity duration-200",
          swipeX < -20 ? "opacity-100" : "opacity-0"
        )}
      >
        <ReplyIcon className="h-5 w-5 text-indigo-500 scale-x-[-1]" />
      </div>

      <div
        style={{ transform: `translateX(${swipeX}px)`, transition: swiping ? "none" : "transform 0.2s" }}
        onTouchStart={startDrag}
        onTouchMove={onDrag}
        onTouchEnd={endDrag}
        onMouseDown={startDrag}
        onMouseMove={onDrag}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        className="relative py-1 flex group/msg"
      >
        {isSystem ? (
          <div className="flex items-start gap-2.5 w-full">
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
          <div className="flex flex-col items-end justify-end w-full">
            <div className="max-w-[80%] relative flex flex-col items-end group/bubble">
              <div className="flex items-center justify-end gap-1.5 mb-0.5">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                  {fmtTime(msg.created_at)}
                </span>
                <span className="text-[10px] font-semibold text-[#07008A] dark:text-[#FED501]">
                  You
                </span>
              </div>
              
              {msg.metadata?.reply_to && (
                <div className="mb-0.5 p-1.5 pl-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-[11px] text-indigo-700 dark:text-indigo-300 border-l-2 border-indigo-400 self-stretch opacity-80 backdrop-blur-sm z-0 translate-y-2 pb-3">
                  <span className="font-bold">{msg.metadata.reply_to.sender}:</span> {msg.metadata.reply_to.content}
                </div>
              )}
              
              <div className="relative z-10 w-full flex justify-end">
                {isEditing ? (
                  <div className="w-full flex flex-col gap-2 bg-[#07008A] rounded-lg p-2 min-w-[200px]">
                    <textarea 
                      autoFocus
                      className="w-full bg-white/10 text-white text-[13px] border-none rounded p-2 focus:ring-1 focus:ring-white/30 resize-none min-h-[60px]"
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                           e.preventDefault();
                           handleUpdateLocal();
                        } else if (e.key === "Escape") {
                           setIsEditing(false);
                        }
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setIsEditing(false)} className="text-[10px] text-white/70 hover:text-white">Cancel</button>
                      <button onClick={handleUpdateLocal} className="bg-white text-[#07008A] text-[10px] font-bold px-3 py-1 rounded">Save Changes</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-end">
                    <p 
                      onClick={() => onSetActive()}
                      className="text-[13px] text-white leading-snug bg-[#07008A] rounded-lg rounded-br-sm px-3 py-2 whitespace-pre-wrap flex-initial break-words max-w-full cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      <MessageContent content={msg.content} teamMembers={teamMembers} />
                    </p>
                    {msg.metadata?.is_edited && (
                      <span className="text-[9px] text-indigo-300/70 mt-0.5 italic">edited</span>
                    )}
                  </div>
                )}
              </div>

              {/* Reactions Bar */}
              {Object.keys(reactionCount).length > 0 && (
                <div className="flex gap-1 mt-1 z-10">
                  {Object.entries(reactionCount).map(([emoji, count]) => (
                    <div key={emoji} className="flex flex-row items-center bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full border border-white dark:border-slate-900 shadow-sm">
                      <span className="text-[11px] leading-none">{emoji}</span>
                      {count > 1 && <span className="text-[9px] font-bold ml-1 text-slate-500">{count}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Seen By */}
              {readByCount > 0 && (
                <div className="flex items-center gap-1 mt-1 opacity-60">
                   <CheckCheck className="h-3 w-3 text-emerald-500" />
                   <span className="text-[9px] text-slate-400 font-medium">Seen</span>
                </div>
              )}
            </div>

            {/* QUICK ACTIONS BAR */}
            <div 
              className={cn(
                "absolute top-0 -translate-y-full mb-1 z-30 transition-all duration-200 flex items-center gap-1",
                "right-0",
                isActive ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:scale-100 group-hover/bubble:pointer-events-auto"
              )}
            >
              <div className="flex items-center gap-0.5 p-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-full">
                <button 
                  onClick={() => setShowReactions(!showReactions)} 
                  className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="React"
                >
                  <SmilePlus className="h-4 w-4" />
                </button>
                <button 
                  onClick={onReply} 
                  className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Reply"
                >
                  <ReplyIcon className="h-4 w-4 scale-x-[-1]" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors outline-none">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl p-1.5 shadow-2xl border-slate-200/60 dark:border-slate-700/60">
                    <DropdownMenuItem onClick={() => setIsEditing(true)} className="rounded-lg gap-2 cursor-pointer">
                      <Pencil className="h-3.5 w-3.5 text-amber-500" />
                      <span>Edit Message</span>
                    </DropdownMenuItem>
                    {(isMe || [1, 5].includes(Number(adminRole))) && (
                      <DropdownMenuItem onClick={onDelete} className="rounded-lg gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20">
                         <Trash2 className="h-3.5 w-3.5" />
                         <span>Delete for Everyone</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={onReply} className="rounded-lg gap-2 cursor-pointer tablet:hidden">
                       <ReplyIcon className="h-3.5 w-3.5 scale-x-[-1]" />
                       <span>Reply</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 w-full">
            <div className="mt-0.5 h-7 w-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold">
                {getInitials(msg.sender_name)}
              </span>
            </div>
            
            <div className="flex-1 min-w-0 max-w-[80%] relative flex flex-col items-start group/bubble">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  {msg.sender_name}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                  {fmtTime(msg.created_at)}
                </span>
              </div>
              
              {msg.metadata?.reply_to && (
                <div className="mb-0.5 p-1.5 pl-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-[11px] text-indigo-700 dark:text-indigo-300 border-l-2 border-indigo-400 self-stretch opacity-80 backdrop-blur-sm z-0 translate-y-2 pb-3">
                  <span className="font-bold">{msg.metadata.reply_to.sender}:</span> {msg.metadata.reply_to.content}
                </div>
              )}
              
               <div className="relative z-10 w-full flex justify-start">
                   <div className="flex flex-col items-start">
                    <p 
                      onClick={() => onSetActive()}
                      className="text-[13px] text-slate-800 dark:text-slate-200 leading-snug bg-slate-100 dark:bg-slate-800 rounded-lg rounded-tl-sm px-3 py-2 whitespace-pre-wrap flex-initial break-words max-w-full cursor-pointer active:scale-[0.98] transition-transform"
                    >
                      <MessageContent content={msg.content} teamMembers={teamMembers} />
                    </p>
                    {msg.metadata?.is_edited && (
                      <span className="text-[9px] text-slate-400 mt-0.5 italic">edited</span>
                    )}
                   </div>
                </div>

              {/* Reactions Bar */}
              {Object.keys(reactionCount).length > 0 && (
                <div className="flex gap-1 mt-1 z-10">
                  {Object.entries(reactionCount).map(([emoji, count]) => (
                    <div key={emoji} className="flex flex-row items-center bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full border border-white dark:border-slate-900 shadow-sm">
                      <span className="text-[11px] leading-none">{emoji}</span>
                      {count > 1 && <span className="text-[9px] font-bold ml-1 text-slate-500">{count}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

             {/* QUICK ACTIONS BAR */}
             <div 
              className={cn(
                "absolute top-0 -translate-y-full mb-1 z-30 transition-all duration-200 flex items-center gap-1",
                "left-0 ml-[38px]",
                isActive ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:scale-100 group-hover/bubble:pointer-events-auto"
              )}
            >
              <div className="flex items-center gap-0.5 p-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg border border-slate-200/60 dark:border-slate-700/60 rounded-full">
                <button 
                  onClick={() => setShowReactions(!showReactions)} 
                  className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="React"
                >
                  <SmilePlus className="h-4 w-4" />
                </button>
                <button 
                  onClick={onReply} 
                  className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  title="Reply"
                >
                  <ReplyIcon className="h-4 w-4 scale-x-[-1]" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="h-8 w-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors outline-none">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="rounded-xl p-1.5 shadow-2xl border-slate-200/60 dark:border-slate-700/60">
                    {(isMe || [1, 5].includes(Number(adminRole))) && (
                      <DropdownMenuItem onClick={onDelete} className="rounded-lg gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20">
                         <Trash2 className="h-3.5 w-3.5" />
                         <span>Delete for Everyone</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}

        {/* Reaction Picker Overlay */}
        {showReactions && (
          <div className="absolute -top-10 right-4 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-1 flex gap-1 z-[100] animate-in fade-in zoom-in-75 slide-in-from-bottom-2">
            {["👍", "❤️", "😂", "😮", "😢"].map((emoji) => (
              <button 
                key={emoji} 
                onClick={() => handleReact(emoji)}
                className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-transform hover:scale-110"
              >
                {emoji}
              </button>
            ))}
            <button onClick={() => setShowReactions(false)} className="h-8 w-8 ml-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 border border-transparent hover:bg-slate-50"><X className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

 // Map alias for Reply
import { CornerUpLeft as ReplyIcon, Pencil, Trash2, MoreHorizontal } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Message Component with Mentions Support                             */
/* ------------------------------------------------------------------ */

function MessageContent({ content, teamMembers }: { content: string, teamMembers: TeamMember[] }) {
  if (content === "👍") return <span className="text-4xl leading-none block py-1">👍</span>;

  // Split by whitespace to check for @mentions
  const tokens = content.split(/(\s+)/);
  
  return (
    <>
      {tokens.map((token, i) => {
        if (token.startsWith("@")) {
          const namePart = token.substring(1);
          // Check if this matches a member name
          const isMention = teamMembers.some(m => namePart.toLowerCase().startsWith(m.name.toLowerCase()));
          if (isMention) {
            return <span key={i} className="text-blue-400 dark:text-[#FED501] font-bold">{token}</span>;
          }
        }
        return <span key={i}>{token}</span>;
      })}
    </>
  );
}
