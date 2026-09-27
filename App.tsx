import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Beer,
  Martini,
  UtensilsCrossed,
  Wine,
  Plus,
  Minus,
  Receipt,
  ClipboardList,
  BookOpen,
  Check,
  Banknote,
  CreditCard,
  Smartphone,
  ArrowLeft,
  Download,
  Calculator,
  Loader2,
  AlertTriangle,
  QrCode,
  Pencil,
  Trash2,
  RefreshCw,
  LogOut,
  Lock,
  UserPlus,
  X,
  Bell,
  BellOff,
} from "lucide-react";
import { supabase, supabaseConfigError } from "./supabase";
import type { Session } from "@supabase/supabase-js";

const ICON_MAP: Record<string, any> = {
  beer: Beer,
  martini: Martini,
  wine: Wine,
  food: UtensilsCrossed,
};

const PAY_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "POS", icon: CreditCard },
  { id: "transfer", label: "Transfer", icon: Smartphone },
];

const FLAG_MINUTES = 55;

const VAPID_PUBLIC_KEY =
  "BO2BNg6rRRW2HCoY7aDop6Kel3hCuSlx7sPL8b55H8THVCOaG516SZlmwgOB3icdqwriFxY3svM50D-f8ZnefJE";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Profile = {
  id: string;
  name: string;
  role: string;
  active?: boolean;
  created_at?: string;
};

type Table = {
  id: number;
  table_number: number;
  active: boolean;
};

type MenuCategory = {
  id: number;
  name: string;
  icon: string | null;
  display_order: number;
  active: boolean;
  created_at?: string;
};

type MenuItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  vip_multiplier: number;
  active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
};

type InventoryItem = {
  id: string;
  item_name: string;
  unit: string;
  opening_stock: number;
  stock_in: number;
  stock_used: number;
  low_stock_level: number;
  menu_item_id: string | null;
  created_at?: string;
  updated_at?: string;
};

function normalizeInventoryItem(item: any): InventoryItem {
  return {
    id: String(item.id),
    item_name: String(item.item_name || "").trim(),
    unit: String(item.unit || "pieces"),
    opening_stock: Number(item.opening_stock ?? 0),
    stock_in: Number(item.stock_in ?? 0),
    stock_used: Number(item.stock_used ?? 0),
    low_stock_level: Number(item.low_stock_level ?? 0),
    menu_item_id: item.menu_item_id ? String(item.menu_item_id) : null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function currentStock(item: InventoryItem) {
  return item.opening_stock + item.stock_in - item.stock_used;
}

type CartItem = MenuItem & { quantity: number };

type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type Order = {
  id: string;
  order_number?: number | string;
  table_id?: number;
  waiter_id: string | null;
  order_source?: string | null;
  status: string;
  payment_status?: string | null;
  payment_method?: string | null;
  total: number;
  created_at: string;
  paid_at: string | null;
  table?: Table;
  waiter?: Profile;
  order_items?: OrderItem[];
  payments?: Payment[];
};

type Payment = {
  id: string;
  order_id: string;
  method: string;
  amount: number;
  confirmed_by: string | null;
  created_at: string;
};

const DEFAULT_TABLES: Table[] = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1,
  table_number: index + 1,
  active: true,
}));

function money(value: number) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function minutesBetween(start: string, end: Date) {
  return Math.round((end.getTime() - new Date(start).getTime()) / 60000);
}

function orderNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "------";
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return String(numericValue).padStart(4, "0");
  }

  return String(value).slice(0, 6).toUpperCase();
}

function newLocalId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeMenuItem(item: any): MenuItem {
  return {
    id: String(item.id),
    category: String(item.category || "Other").trim() || "Other",
    name: String(item.name || "").trim(),
    description: item.description ?? null,
    price: Number(item.price || 0),
    vip_multiplier: Number(item.vip_multiplier ?? 2),
    active: Boolean(item.available ?? item.active ?? true),
    display_order: Number(item.display_order || 0),
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function isPaid(order: Order) {
  return order.payment_status === "paid" || order.status === "paid";
}

function StatCard({
  label,
  value,
  accent = false,
  danger = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #3A3634",
        background: "#1A1817",
      }}
      className="rounded-sm p-3"
    >
      <p
        style={{
          color: "#8A8478",
          ...{ fontFamily: "var(--mono)" },
        }}
        className="text-[10px] uppercase"
      >
        {label}
      </p>
      <p
        style={{
          color: danger ? "#C97C7C" : accent ? "#C68A3F" : "#F5EFE4",
          fontFamily: "var(--mono)",
        }}
        className="text-lg font-semibold mt-1"
      >
        {value}
      </p>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState("landing");

  const [tables, setTables] = useState<Table[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const [staffFilter, setStaffFilter] = useState<
    "open" | "paid" | "all" | "vip"
  >("open");

  const [now, setNow] = useState(new Date());

  const [editingItem, setEditingItem] = useState<string | null>(null);

  const [editingStockItem, setEditingStockItem] = useState<string | null>(null);

  const [showNewInventoryForm, setShowNewInventoryForm] = useState(false);

  const [syncingInventory, setSyncingInventory] = useState(false);

  const [newItemDraft, setNewItemDraft] = useState<
    Record<
      number,
      { name: string; price: string; description: string; vipMultiplier: string }
    >
  >({});

  // Auth form state
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState<"waiter" | "accountant">("waiter");
  const [authLoading, setAuthLoading] = useState(false);

  const role = profile?.role ?? null;

  /*
   * ============================================================
   * AUTH
   * ============================================================
   */

  async function loadProfile(userId: string) {
    try {
      setError("");

      console.log("Loading profile for Auth user:", userId);

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, name:full_name, role, created_at")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("PROFILE ERROR:", profileError);

        setProfile(null);
        setError(`Could not load your profile: ${profileError.message}`);

        return;
      }

      if (!data) {
        console.error("NO PROFILE FOUND FOR USER:", userId);

        setProfile(null);
        setError(
          "Your login worked, but no staff profile was found for this account.",
        );

        return;
      }

      console.log("Profile loaded:", data);

      setProfile(data as Profile);

      if (data.role === "accountant") {
        setView("ledger");
      } else if (data.role === "waiter") {
        setView("landing");
      } else {
        setError(
          `Your profile has an invalid role: "${data.role}". Set the role to "waiter" or "accountant" in the profiles table.`,
        );
      }
    } catch (err: any) {
      console.error("LOAD PROFILE ERROR:", err);

      setProfile(null);
      setError(err?.message || "Something went wrong loading your profile.");
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      checkPushSubscription();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    let mounted = true;

    if (supabaseConfigError) {
      setError(supabaseConfigError);
      setSession(null);
      setProfile(null);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    async function initializeAuth() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession);

        if (currentSession) {
          await loadProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (err: any) {
        console.error("AUTH INITIALIZATION ERROR:", err);

        if (mounted) {
          setError(err?.message || "Could not initialize authentication.");
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);

      if (!newSession) {
        setProfile(null);
        setView("landing");
        setLoading(false);
        return;
      }

      setLoading(true);

      await loadProfile(newSession.user.id);

      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();

    if (!authEmail.trim() || !authPassword) {
      setError("Enter your email and password.");
      return;
    }

    setAuthLoading(true);
    setError("");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (signInError) {
        throw signInError;
      }
    } catch (err: any) {
      console.error("SIGN IN ERROR:", err);

      setError(
        err?.message || "Sign in failed. Check your email and password.",
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();

    if (!authName.trim() || !authEmail.trim() || !authPassword) {
      setError("Please complete all fields.");
      return;
    }

    if (authPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setAuthLoading(true);
    setError("");

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
        options: {
          data: {
            full_name: authName.trim(),
            role: authRole,
          },
        },
      });

      if (signupError) {
        console.error("Signup error:", signupError);
        setError(signupError.message);
        return;
      }

      if (data.user) {
        setError(
          "Account created successfully. Please check the email for verification if required.",
        );
      }
    } catch (err) {
      console.error("Unexpected signup error:", err);
      setError("Something went wrong while creating the account.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function checkPushSubscription() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setPushEnabled(!!existing);
    } catch (err) {
      console.error("PUSH CHECK ERROR:", err);
    }
  }

  async function enablePushNotifications() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setError("Push notifications aren't supported on this browser/device.");
        return;
      }

      if (!session?.user?.id) {
        setError("Sign in before enabling notifications.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = subscription.toJSON();

      const { error: upsertError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            staff_id: session.user.id,
            endpoint: json.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          },
          { onConflict: "endpoint" },
        );

      if (upsertError) throw upsertError;

      setPushEnabled(true);
    } catch (err: any) {
      console.error("PUSH SUBSCRIBE ERROR:", err);
      setError(err.message || "Could not enable notifications.");
    }
  }

  async function disablePushNotifications() {
    try {
      if (!("serviceWorker" in navigator)) return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);

        await subscription.unsubscribe();
      }

      setPushEnabled(false);
    } catch (err: any) {
      console.error("PUSH UNSUBSCRIBE ERROR:", err);
      setError(err.message || "Could not disable notifications.");
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("SIGN OUT ERROR:", err);
    }

    setProfile(null);
    setSession(null);
    setView("landing");
    setCart({});
    setSelectedTable(null);
    setConfirmedOrder(null);

    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");
    setAuthMode("signin");
    setError("");
  }

  /*
   * ============================================================
   * LOAD DATABASE
   * ============================================================
   */

  async function loadTables() {
    const { data, error } = await supabase
      .from("bar_tables")
      .select("*")
      .eq("active", true)
      .order("table_number");

    if (error || !data?.length) {
      console.warn(
        "bar_tables is unavailable; using the standard table selector.",
        error?.message,
      );
      setTables(DEFAULT_TABLES);
      return;
    }

    setTables(data as Table[]);
  }

  async function loadMenu() {
    try {
      const itemResult = await supabase
        .from("menu_items")
        .select(
          "id, name, category, price, vip_multiplier, description, available, created_at, updated_at",
        )
        .eq("available", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (itemResult.error) throw itemResult.error;

      const itemData = (itemResult.data || []).map(normalizeMenuItem);
      const categoryNames = Array.from(
        new Set(itemData.map((item) => item.category)),
      );
      const categoryData: MenuCategory[] = categoryNames.map((name, index) => ({
        id: index + 1,
        name,
        icon: null,
        display_order: index,
        active: true,
      }));

      setCategories(categoryData);
      setMenuItems(itemData);
    } catch (err: any) {
      console.error("LOAD MENU ERROR:", err);
      throw err;
    }
  }

  async function loadInventory() {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("item_name", { ascending: true });

      if (error) throw error;

      setInventoryItems((data || []).map(normalizeInventoryItem));
    } catch (err: any) {
      console.error("LOAD INVENTORY ERROR:", err);
      throw err;
    }
  }
  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        waiter:profiles(id, full_name, role, created_at),
        order_items(*)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const normalizedOrders = (data || []).map((rawOrder: any) => {
      const tableMatch = String(rawOrder.notes || "").match(/table\s+(\d+)/i);
      const tableNumber = tableMatch ? Number(tableMatch[1]) : undefined;
      const paymentTimestamp =
        rawOrder.payment_status === "paid"
          ? rawOrder.updated_at || rawOrder.created_at
          : null;

      return {
        ...rawOrder,
        id: String(rawOrder.id),
        order_number: rawOrder.order_number ?? String(rawOrder.id),
        table_id: tableNumber,
        table: tableNumber
          ? {
              id: tableNumber,
              table_number: tableNumber,
              active: true,
            }
          : undefined,
        waiter: rawOrder.waiter
          ? {
              id: rawOrder.waiter.id,
              name: rawOrder.waiter.full_name,
              role: rawOrder.waiter.role,
              created_at: rawOrder.waiter.created_at,
            }
          : undefined,
        order_items: (rawOrder.order_items || []).map((item: any) => ({
          ...item,
          id: String(item.id),
          order_id: String(item.order_id),
          menu_item_id: item.menu_item_id ? String(item.menu_item_id) : "",
          unit_price: Number(item.unit_price || 0),
          subtotal: Number(item.total_price ?? item.subtotal ?? 0),
        })),
        total: Number(rawOrder.total || 0),
        paid_at: paymentTimestamp,
        payments: rawOrder.payment_method
          ? [
              {
                id: `${rawOrder.id}-payment`,
                order_id: String(rawOrder.id),
                method: rawOrder.payment_method,
                amount: Number(rawOrder.total || 0),
                confirmed_by: null,
                created_at: paymentTimestamp || rawOrder.updated_at,
              },
            ]
          : [],
      } as Order;
    });

    setOrders(normalizedOrders);
  }

  async function loadEverything() {
    try {
      setLoading(true);
      setError("");

      await Promise.all([loadTables(), loadMenu(), loadOrders(), loadInventory()]);
    } catch (err: any) {
      console.error("DATABASE LOAD ERROR:", err);

      setError(err?.message || "Could not load data from the database.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session && profile) {
      loadEverything();
    }
  }, [session?.user.id, profile?.id]);

  /*
   * ============================================================
   * REAL-TIME NEW ORDER NOTIFICATIONS
   * Plays a generated tone (no audio file needed) and shows an
   * on-screen banner the instant a new order is inserted, using
   * Supabase Realtime — no manual refresh required.
   * ============================================================
   */

  function playNotificationSound() {
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();

      const playBeep = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
        gain.gain.linearRampToValueAtTime(
          0,
          ctx.currentTime + start + duration,
        );

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playBeep(880, 0, 0.15);
      playBeep(1108, 0.18, 0.2);
    } catch (err) {
      console.error("Notification sound error:", err);
    }
  }

  function showNewOrderToast(message: string) {
    const toast = document.createElement("div");
    toast.textContent = message;

    Object.assign(toast.style, {
      position: "fixed",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%) translateY(-20px)",
      background: "#C68A3F",
      color: "#211F1E",
      padding: "14px 22px",
      borderRadius: "10px",
      fontWeight: "700",
      fontSize: "14px",
      zIndex: "99999",
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      opacity: "0",
      transition: "opacity 0.25s ease, transform 0.25s ease",
      maxWidth: "90vw",
      textAlign: "center",
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(-20px)";
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  useEffect(() => {
    if (!session || !profile) return;

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new as any;
          const isVip = newOrder.order_source === "vip";
          const amount = Number(newOrder.total || 0);

          playNotificationSound();

          showNewOrderToast(
            isVip
              ? `New VIP order — ₦${amount.toLocaleString()}`
              : `New order #${newOrder.order_number} — ₦${amount.toLocaleString()}`,
          );

          loadOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user.id, profile?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  /*
   * ============================================================
   * MENU
   * ============================================================
   */

  const groupedMenu = useMemo(() => {
    return categories.map((category) => ({
      ...category,
      items: menuItems
        .filter(
          (item) =>
            (item.category || "").trim().toLowerCase() ===
            (category.name || "").trim().toLowerCase(),
        )
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    }));
  }, [categories, menuItems]);

  const lowStockItems = useMemo(() => {
    return inventoryItems
      .filter((item) => currentStock(item) <= item.low_stock_level)
      .sort((a, b) => currentStock(a) - currentStock(b));
  }, [inventoryItems]);

  const unsyncedMenuItemsCount = useMemo(() => {
    const linkedMenuItemIds = new Set(
      inventoryItems
        .map((item) => item.menu_item_id)
        .filter((id): id is string => Boolean(id)),
    );

    return menuItems.filter((menuItem) => !linkedMenuItemIds.has(menuItem.id))
      .length;
  }, [inventoryItems, menuItems]);

  const cartItems = useMemo<CartItem[]>(() => {
    return Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => {
        const item = menuItems.find((menuItem) => menuItem.id === id);

        if (!item) return null;

        return {
          ...item,
          quantity,
        };
      })
      .filter(Boolean) as CartItem[];
  }, [cart, menuItems]);

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  function addToCart(itemId: string, amount: number) {
    setCart((current) => ({
      ...current,
      [itemId]: Math.max(0, (current[itemId] || 0) + amount),
    }));
  }

  function resetOrdering() {
    setSelectedTable(null);
    setCart({});
    setConfirmedOrder(null);
    setError("");
    setView("table-select");
  }

  /*
   * ============================================================
   * ORDERS
   * ============================================================
   */

  async function submitOrder() {
    if (!session) {
      setError("You must be signed in.");
      return;
    }

    if (!selectedTable) {
      setError("Please select a table.");
      return;
    }

    if (cartItems.length === 0) {
      setError("Please add at least one item.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const { data: createdOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_type: "staff",
          waiter_id: session.user.id,
          status: "pending",
          payment_status: "unpaid",
          subtotal: cartTotal,
          total: cartTotal,
          notes: `Table ${selectedTable.table_number}`,
        })
        .select("*")
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map((item) => ({
        id: newLocalId(),
        order_id: String(createdOrder.id),
        menu_item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
      }));

      const { error: itemError } = await supabase
        .from("order_items")
        .insert(
          orderItems.map(({ subtotal: _subtotal, id: _id, ...item }) => item),
        );

      if (itemError) {
        await supabase.from("orders").delete().eq("id", createdOrder.id);

        throw itemError;
      }

      const completeOrder: Order = {
        ...createdOrder,
        id: String(createdOrder.id),
        order_number: String(createdOrder.id),
        table_id: selectedTable.table_number,
        status: "pending",
        payment_status: "unpaid",
        paid_at: null,
        table: selectedTable,
        waiter: profile || undefined,
        order_items: orderItems.map(
          (item, index) =>
            ({
              ...item,
              id: String(index + 1),
            }) as OrderItem,
        ),
        payments: [],
      };

      setOrders((current) => [completeOrder, ...current]);

      setConfirmedOrder(completeOrder);

      setCart({});
      setView("confirmed");
    } catch (err: any) {
      console.error("SUBMIT ORDER ERROR:", err);

      setError(
        err?.message || "The order could not be saved. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * ============================================================
   * PAYMENTS
   * ============================================================
   */

  async function markPaid(order: Order, method: string) {
    if (!session) {
      setError("You must be signed in.");
      return;
    }

    try {
      setError("");

      const paidAt = new Date().toISOString();

      const { error: orderError } = await supabase
        .from("orders")
        .update({
          payment_method: method,
          payment_status: "paid",
          status: "received",
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                payment_method: method,
                payment_status: "paid",
                status: "received",
                paid_at: paidAt,
                payments: [
                  ...(item.payments || []),
                  {
                    id: `${item.id}-payment`,
                    order_id: order.id,
                    method,
                    amount: order.total,
                    confirmed_by: session.user.id,
                    created_at: paidAt,
                  },
                ],
              }
            : item,
        ),
      );
    } catch (err: any) {
      console.error("PAYMENT ERROR:", err);

      setError(err?.message || "Payment could not be recorded.");
    }
  }

  /*
   * ============================================================
   * MENU MANAGEMENT
   * ============================================================
   */

  async function updateMenuItem(
    item: MenuItem,
    name: string,
    price: string,
    description: string,
    vipMultiplier: string,
  ) {
    const parsedPrice = Number(price);
    const parsedMultiplier = Number(vipMultiplier);

    if (!name.trim()) {
      setError("Item name cannot be empty.");
      return;
    }

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Enter a valid price.");
      return;
    }

    if (Number.isNaN(parsedMultiplier) || parsedMultiplier <= 0) {
      setError("Enter a valid VIP multiplier (e.g. 1.25, 1.5, 2).");
      return;
    }

    try {
      setError("");

      const { data, error } = await supabase
        .from("menu_items")
        .update({
          name: name.trim(),
          price: parsedPrice,
          vip_multiplier: parsedMultiplier,
          description: description.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .select("*")
        .single();

      if (error) throw error;

      setMenuItems((current) =>
        current.map((menuItem) =>
          menuItem.id === item.id ? normalizeMenuItem(data) : menuItem,
        ),
      );

      setEditingItem(null);
    } catch (err: any) {
      console.error("UPDATE MENU ERROR:", err);

      setError(err?.message || "The menu item could not be updated.");
    }
  }

  async function updateVipPrice(item: MenuItem, vipPriceInput: string) {
    const vipPrice = Number(vipPriceInput);

    if (Number.isNaN(vipPrice) || vipPrice < 0) {
      setError("Enter a valid VIP price.");
      return;
    }

    if (!item.price || item.price <= 0) {
      setError(
        `"${item.name}" has no regular price set, so a VIP multiplier can't be calculated.`,
      );
      return;
    }

    const multiplier = vipPrice / item.price;

    try {
      setError("");

      const { data, error } = await supabase
        .from("menu_items")
        .update({
          vip_multiplier: multiplier,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .select("*")
        .single();

      if (error) throw error;

      setMenuItems((current) =>
        current.map((menuItem) =>
          menuItem.id === item.id ? normalizeMenuItem(data) : menuItem,
        ),
      );
    } catch (err: any) {
      console.error("UPDATE VIP PRICE ERROR:", err);
      setError(err?.message || "The VIP price could not be updated.");
    }
  }

  const removeMenuItem = async (item: MenuItem) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${item.name}"?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", item.id);

      if (error) {
        console.error("Delete menu item error:", error);
        alert(`Could not delete "${item.name}": ${error.message}`);
        return;
      }

      setMenuItems((prev) =>
        prev.filter((menuItem) => menuItem.id !== item.id),
      );

      alert(`"${item.name}" has been deleted.`);
    } catch (err) {
      console.error("Unexpected delete error:", err);
      alert("Something went wrong while deleting the menu item.");
    }
  };

  async function createInventoryItem(
    itemName: string,
    unit: string,
    openingStock: string,
    lowStockLevel: string,
    menuItemId: string | null,
  ) {
    if (!itemName.trim()) {
      setError("Enter an item name.");
      return;
    }

    const parsedOpening = Number(openingStock);
    const parsedLow = Number(lowStockLevel);

    if (Number.isNaN(parsedOpening) || parsedOpening < 0) {
      setError("Enter a valid opening stock.");
      return;
    }

    if (Number.isNaN(parsedLow) || parsedLow < 0) {
      setError("Enter a valid low stock level.");
      return;
    }

    try {
      setError("");

      const { data, error } = await supabase
        .from("inventory")
        .insert({
          item_name: itemName.trim(),
          unit: unit.trim() || "pieces",
          opening_stock: parsedOpening,
          stock_in: 0,
          stock_used: 0,
          low_stock_level: parsedLow,
          menu_item_id: menuItemId,
        })
        .select("*")
        .single();

      if (error) throw error;

      setInventoryItems((current) =>
        [...current, normalizeInventoryItem(data)].sort((a, b) =>
          a.item_name.localeCompare(b.item_name),
        ),
      );
    } catch (err: any) {
      console.error("CREATE INVENTORY ITEM ERROR:", err);

      setError(err?.message || "Inventory item could not be created.");
    }
  }

  async function updateInventoryItem(
    item: InventoryItem,
    lowStockLevel: string,
    unit: string,
    menuItemId: string | null,
  ) {
    const parsedLow = Number(lowStockLevel);

    if (Number.isNaN(parsedLow) || parsedLow < 0) {
      setError("Enter a valid low stock level.");
      return;
    }

    try {
      setError("");

      const { data, error } = await supabase
        .from("inventory")
        .update({
          low_stock_level: parsedLow,
          unit: unit.trim() || "pieces",
          menu_item_id: menuItemId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .select("*")
        .single();

      if (error) throw error;

      setInventoryItems((current) =>
        current.map((invItem) =>
          invItem.id === item.id ? normalizeInventoryItem(data) : invItem,
        ),
      );

      setEditingStockItem(null);
    } catch (err: any) {
      console.error("UPDATE INVENTORY ITEM ERROR:", err);

      setError(err?.message || "Inventory item could not be updated.");
    }
  }

  async function addStock(item: InventoryItem, addQuantity: number) {
    if (!addQuantity || addQuantity <= 0) return;

    try {
      setError("");

      const newStockIn = item.stock_in + addQuantity;

      const { data, error } = await supabase
        .from("inventory")
        .update({
          stock_in: newStockIn,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .select("*")
        .single();

      if (error) throw error;

      setInventoryItems((current) =>
        current.map((invItem) =>
          invItem.id === item.id ? normalizeInventoryItem(data) : invItem,
        ),
      );
    } catch (err: any) {
      console.error("ADD STOCK ERROR:", err);

      setError(err?.message || "Stock could not be added.");
    }
  }

  async function deleteInventoryItem(item: InventoryItem) {
    const confirmed = window.confirm(
      `Delete "${item.item_name}" from inventory? This cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setError("");

      const { error } = await supabase
        .from("inventory")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      setInventoryItems((current) =>
        current.filter((invItem) => invItem.id !== item.id),
      );
    } catch (err: any) {
      console.error("DELETE INVENTORY ITEM ERROR:", err);

      setError(err?.message || "Inventory item could not be deleted.");
    }
  }

  async function syncInventoryFromMenu() {
    try {
      setError("");
      setSyncingInventory(true);

      const linkedMenuItemIds = new Set(
        inventoryItems
          .map((item) => item.menu_item_id)
          .filter((id): id is string => Boolean(id)),
      );

      const unlinkedMenuItems = menuItems.filter(
        (menuItem) => !linkedMenuItemIds.has(menuItem.id),
      );

      if (unlinkedMenuItems.length === 0) {
        setSyncingInventory(false);
        return;
      }

      const rows = unlinkedMenuItems.map((menuItem) => ({
        item_name: menuItem.name,
        unit: "pieces",
        opening_stock: 0,
        stock_in: 0,
        stock_used: 0,
        low_stock_level: 0,
        menu_item_id: menuItem.id,
      }));

      const { data, error } = await supabase
        .from("inventory")
        .insert(rows)
        .select("*");

      if (error) throw error;

      setInventoryItems((current) =>
        [...current, ...(data || []).map(normalizeInventoryItem)].sort(
          (a, b) => a.item_name.localeCompare(b.item_name),
        ),
      );
    } catch (err: any) {
      console.error("SYNC INVENTORY ERROR:", err);

      setError(err?.message || "Could not sync menu items into inventory.");
    } finally {
      setSyncingInventory(false);
    }
  }

  const addMenuItem = async (categoryId: number) => {
    const draft = newItemDraft[categoryId] || {
      name: "",
      price: "",
      description: "",
      vipMultiplier: "2",
    };

    if (!draft.name.trim()) {
      alert("Please enter the menu item name.");
      return;
    }

    if (!draft.price || Number(draft.price) <= 0) {
      alert("Please enter a valid price.");
      return;
    }

    const vipMultiplier = Number(draft.vipMultiplier);
    if (!draft.vipMultiplier || Number.isNaN(vipMultiplier) || vipMultiplier <= 0) {
      alert("Please enter a valid VIP multiplier (e.g. 1.25, 1.5, 2).");
      return;
    }

    const categoryName =
      categories.find((category) => category.id === categoryId)?.name?.trim() || "";

    if (!categoryName) {
      alert("Please select a valid menu category.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("menu_items")
        .insert({
          category: categoryName,
          name: draft.name.trim(),
          description: draft.description?.trim() || null,
          price: Number(draft.price),
          vip_multiplier: vipMultiplier,
          available: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Add menu item error:", error);
        alert(`Could not add menu item: ${error.message}`);
        return;
      }

      if (!data) {
        alert("Menu item was not created.");
        return;
      }

      setMenuItems((prev) => [...prev, normalizeMenuItem(data)]);

      setNewItemDraft((current) => ({
        ...current,
        [categoryId]: { name: "", price: "", description: "", vipMultiplier: "2" },
      }));

      alert("Menu item added successfully.");
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("Something went wrong while adding the menu item.");
    }
  };
  /*
   * ============================================================
   * CSV EXPORT
   * ============================================================
   */

  function exportCSV() {
    const rows = [
      [
        "Order #",
        "Table",
        "Waiter",
        "Items",
        "Total",
        "Payment Method",
        "Status",
        "Created At",
        "Paid At",
      ],

      ...orders.map((order) => {
        const payment = order.payments?.[order.payments.length - 1];

        const items =
          order.order_items
            ?.map((item) => `${item.quantity}x ${item.item_name}`)
            .join("; ") || "";

        return [
          orderNumber(order.order_number),
          order.table?.table_number || order.table_id,
          order.waiter?.name || order.waiter_id,
          items,
          order.total.toFixed(2),
          payment?.method || "",
          order.status,
          new Date(order.created_at).toLocaleString(),
          order.paid_at ? new Date(order.paid_at).toLocaleString() : "",
        ];
      }),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "chow-n-vibes-sales-ledger.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /*
   * ============================================================
   * ACCOUNTING CALCULATIONS
   * ============================================================
   */

  const paidOrders = orders.filter(isPaid);

  const totalSales = paidOrders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0,
  );

  const awaitingPayment = orders.filter(
    (order) => !isPaid(order),
  ).length;

  const byMethod = PAY_METHODS.map((method) => ({
    ...method,

    total: paidOrders
      .filter((order) =>
        order.payments?.some((payment) => payment.method === method.id),
      )
      .reduce((sum, order) => sum + Number(order.total || 0), 0),
  }));

  function isFlagged(order: Order) {
    return (
      !isPaid(order) &&
      minutesBetween(order.created_at, now) >= FLAG_MINUTES
    );
  }

  const flaggedOrders = orders.filter(isFlagged);

  /*
   * ============================================================
   * STYLES
   * ============================================================
   */

  const shellStyle = {
    background: "var(--ink)",
    minHeight: "100dvh",
    color: "var(--cream)",
    fontFamily: "var(--sans)",
  };

  const monoStyle = {
    fontFamily: "var(--mono)",
  };

  const inputStyle = {
    background: "var(--ink-deep)",
    border: "1px solid var(--line)",
    color: "var(--cream)",
    ...monoStyle,
  };

  const fonts = (
    <style>{`
      * {
        box-sizing: border-box;
      }

      html,
      body,
      #root {
        min-height: 100%;
        margin: 0;
      }

      body { background: var(--ink); }

      button {
        cursor: pointer;
      }

      input,
      textarea {
        outline: none;
      }

      button:disabled {
        cursor: not-allowed;
      }
    `}</style>
  );

  /*
   * ============================================================
   * NAVIGATION
   * ============================================================
   */

  function NavBar() {
    return (
      <div
        role="alert"
        aria-live="polite"
        style={{
          borderBottom: "1px solid #3A3634",
        }}
        className="flex items-center justify-between px-5 py-3"
      >
        <span className="flex items-center gap-2" style={monoStyle}>
          <Receipt size={18} color="#C68A3F" />

          <span className="text-sm text-[#C68A3F]">CHOW 'N' VIBES</span>

          <span
            style={{
              color: "#6B655C",
            }}
            className="text-[10px] uppercase"
          >
            · {profile?.name}
          </span>
        </span>

        <div className="flex gap-1 items-center">
          {role === "waiter" && (
            <>
              <button
                onClick={() => setView("landing")}
                style={{
                  ...monoStyle,
                  background: [
                    "landing",
                    "table-select",
                    "menu",
                    "confirmed",
                  ].includes(view)
                    ? "#C68A3F"
                    : "transparent",

                  color: [
                    "landing",
                    "table-select",
                    "menu",
                    "confirmed",
                  ].includes(view)
                    ? "#211F1E"
                    : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
              >
                Order
              </button>

              <button
                onClick={() => setView("staff")}
                style={{
                  ...monoStyle,
                  background: view === "staff" ? "#C68A3F" : "transparent",

                  color: view === "staff" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
              >
                Queue
              </button>
            </>
          )}

          {role === "accountant" && (
            <>
              <button
                onClick={() => setView("ledger")}
                style={{
                  ...monoStyle,
                  background: view === "ledger" ? "#C68A3F" : "transparent",

                  color: view === "ledger" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
              >
                Ledger
              </button>

              <button
                onClick={() => setView("menu-manage")}
                style={{
                  ...monoStyle,
                  background:
                    view === "menu-manage" ? "#C68A3F" : "transparent",

                  color: view === "menu-manage" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
              >
                Menu
              </button>

              <button
                onClick={() => setView("vip-menu")}
                style={{
                  ...monoStyle,
                  background: view === "vip-menu" ? "#C68A3F" : "transparent",

                  color: view === "vip-menu" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
              >
                VIP Menu
              </button>

              <button
                onClick={() => setView("inventory")}
                style={{
                  ...monoStyle,
                  background:
                    view === "inventory" ? "#C68A3F" : "transparent",

                  color: view === "inventory" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="relative text-xs px-3 py-1.5 rounded-sm"
              >
                Inventory
                {lowStockItems.length > 0 && (
                  <span
                    style={{
                      background: "#B8763F",
                      color: "#211F1E",
                      minWidth: 16,
                      height: 16,
                    }}
                    className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-[9px] font-semibold px-1"
                  >
                    {lowStockItems.length}
                  </span>
                )}
              </button>
            </>
          )}

          <button
            onClick={() =>
              pushEnabled ? disablePushNotifications() : enablePushNotifications()
            }
            style={{
              color: pushEnabled ? "#C68A3F" : "#8A8478",
            }}
            className="p-1.5 rounded-sm hover:text-[#C68A3F]"
            title={pushEnabled ? "Notifications on" : "Enable notifications"}
          >
            {pushEnabled ? <Bell size={15} /> : <BellOff size={15} />}
          </button>

          <button
            onClick={signOut}
            style={{
              color: "#8A8478",
            }}
            className="ml-2 p-1.5 rounded-sm hover:text-[#C97C7C]"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ERROR
   * ============================================================
   */

  function ErrorBox() {
    if (!error) return null;

    return (
      <div
        style={{
          background: "#3A2020",
          border: "1px solid #8B3A3A",
          color: "#F0BABA",
        }}
        className="mx-5 mt-4 p-3 rounded-sm text-xs flex gap-2 items-start"
      >
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />

        <div className="flex-1">{error}</div>

        <button
          onClick={() => setError("")}
          style={{
            color: "#F0BABA",
          }}
          aria-label="Dismiss message"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6"
      >
        {fonts}

        <div
          className="w-full max-w-xs space-y-3"
          aria-label="Loading staff console"
        >
          <div className="skeleton-line w-20" />
          <div className="skeleton-line w-40" />
          <div className="mt-7 space-y-2">
            <div className="skeleton-line w-full" />
            <div className="skeleton-line w-4/5" />
            <div className="skeleton-line w-3/5" />
          </div>
        </div>
        <span style={{ ...monoStyle, color: "#8A8478" }} className="text-xs">
          preparing the service floor...
        </span>
      </div>
    );
  }

  /*
   * ============================================================
   * AUTH SCREEN
   * ============================================================
   */

  if (!session) {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16 text-center"
      >
        {fonts}

        <div className="flex items-center gap-2 mb-8">
          <Receipt size={19} color="#C68A3F" />

          <span
            style={{
              ...monoStyle,
              color: "#C68A3F",
            }}
            className="text-sm"
          >
            CHOW 'N' VIBES
          </span>
        </div>

        <p
          style={{
            color: "#8A8478",
          }}
          className="text-sm mb-6"
        >
          {authMode === "signin"
            ? "Sign in to your account"
            : "Create a new account"}
        </p>

        <form
          onSubmit={authMode === "signin" ? signIn : signUp}
          className="flex flex-col gap-3 w-full max-w-xs"
        >
          {authMode === "signup" && (
            <input
              value={authName}
              onChange={(e) => setAuthName(e.target.value)}
              placeholder="Full name"
              style={inputStyle}
              className="px-3 py-2.5 rounded-sm text-sm"
            />
          )}

          <input
            type="email"
            autoComplete="email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="Email address"
            style={inputStyle}
            className="px-3 py-2.5 rounded-sm text-sm"
          />

          <input
            type="password"
            autoComplete={
              authMode === "signin" ? "current-password" : "new-password"
            }
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="Password"
            style={inputStyle}
            className="px-3 py-2.5 rounded-sm text-sm"
          />

          {authMode === "signup" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthRole("waiter")}
                style={{
                  ...monoStyle,
                  background: authRole === "waiter" ? "#C68A3F" : "transparent",

                  color: authRole === "waiter" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="flex-1 py-2.5 rounded-sm text-xs flex items-center justify-center gap-1.5"
              >
                <ClipboardList size={13} />
                Waiter
              </button>

              <button
                type="button"
                onClick={() => setAuthRole("accountant")}
                style={{
                  ...monoStyle,
                  background:
                    authRole === "accountant" ? "#C68A3F" : "transparent",

                  color: authRole === "accountant" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="flex-1 py-2.5 rounded-sm text-xs flex items-center justify-center gap-1.5"
              >
                <Calculator size={13} />
                Accountant
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            style={{
              background: authLoading ? "#66502F" : "#C68A3F",

              color: "#211F1E",
              ...monoStyle,
            }}
            className="py-3 rounded-sm text-sm font-medium flex items-center justify-center gap-2"
          >
            {authLoading && <Loader2 size={15} className="animate-spin" />}

            {authMode === "signin" ? (
              <>
                <Lock size={15} />
                Sign in
              </>
            ) : (
              <>
                <UserPlus size={15} />
                Create account
              </>
            )}
          </button>
        </form>

        <button
          onClick={() => {
            setAuthMode(authMode === "signin" ? "signup" : "signin");
            setError("");
          }}
          style={{
            ...monoStyle,
            color: "#8A8478",
          }}
          className="text-xs mt-5"
        >
          {authMode === "signin"
            ? "Don't have an account? Sign up"
            : "Already have an account? Sign in"}
        </button>

        <ErrorBox />
      </div>
    );
  }

  /*
   * ============================================================
   * PROFILE FALLBACK
   * ============================================================
   *
   * THIS IS THE IMPORTANT BLANK-SCREEN FIX.
   *
   * If authentication succeeds but the profiles row is missing,
   * the old application reached `return null`.
   *
   * Now the user gets a visible explanation instead.
   */

  if (!profile || !role) {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center"
      >
        {fonts}

        <AlertTriangle size={40} color="#C68A3F" className="mb-4" />

        <h2 className="text-xl font-semibold mb-2">Account setup incomplete</h2>

        <p
          style={{
            color: "#8A8478",
          }}
          className="text-sm max-w-md mb-4"
        >
          You successfully signed in, but your staff profile could not be
          loaded.
        </p>

        {error && (
          <div
            style={{
              background: "#3A2020",
              border: "1px solid #8B3A3A",
              color: "#F0BABA",
            }}
            className="max-w-md w-full p-3 rounded-sm text-xs mb-5"
          >
            {error}
          </div>
        )}

        <p
          style={{
            color: "#6B655C",
          }}
          className="text-[11px] max-w-sm mb-5"
        >
          Check Supabase → Table Editor → profiles and make sure the profile ID
          matches this Auth user's UUID and the role is either waiter or
          accountant.
        </p>

        <button
          onClick={signOut}
          style={{
            background: "#C68A3F",
            color: "#211F1E",
            ...monoStyle,
          }}
          className="px-5 py-3 rounded-sm text-sm font-semibold"
        >
          Sign Out
        </button>
      </div>
    );
  }

  /*
   * ============================================================
   * WAITER LANDING + QR
   * ============================================================
   */

  if (role === "waiter" && view === "landing") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="flex flex-col items-center justify-center px-6 text-center min-h-[calc(100dvh-64px)]">
          <p
            style={{
              ...monoStyle,
              color: "#C68A3F",
            }}
            className="text-xs mb-1"
          >
            CHOW 'N' VIBES
          </p>

          <button
            onClick={resetOrdering}
            style={{
              background: "#C68A3F",
              color: "#211F1E",
              ...monoStyle,
            }}
            className="py-3 rounded-sm font-medium text-sm w-full max-w-xs flex items-center justify-center gap-2"
          >
            <QrCode size={16} />
            Start an order
          </button>

          <p
            style={{
              color: "#6B655C",
            }}
            className="text-xs mt-6 max-w-xs"
          >
            Select the table you're serving, take the order and submit it to the
            queue.
          </p>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * TABLE SELECTION
   * ============================================================
   */

  if (role === "waiter" && view === "table-select") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-6 py-8">
          <button
            onClick={() => setView("landing")}
            className="flex items-center gap-1 text-xs mb-7"
            style={{
              color: "#8A8478",
              ...monoStyle,
            }}
          >
            <ArrowLeft size={14} />
            back
          </button>

          <div className="text-center mb-5">
            <p
              style={{
                ...monoStyle,
                color: "#C68A3F",
              }}
              className="text-xs"
            >
              TABLE SELECTION
            </p>

            <p
              style={{
                color: "#8A8478",
              }}
              className="text-sm mt-1"
            >
              Which table are you serving?
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 w-full max-w-xs mx-auto">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => {
                  setSelectedTable(table);
                  setCart({});
                  setView("menu");
                }}
                style={{
                  border: "1px solid #3A3634",
                  ...monoStyle,
                }}
                className="aspect-square rounded-sm text-lg font-semibold flex items-center justify-center"
              >
                {table.table_number}
              </button>
            ))}
          </div>

          {tables.length === 0 && (
            <p
              style={{
                color: "#6B655C",
              }}
              className="text-xs text-center mt-6"
            >
              No active tables were found.
            </p>
          )}
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * MENU / TAKE ORDER
   * ============================================================
   */

  if (role === "waiter" && view === "menu") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 pt-4 pb-40">
          <div className="flex items-center justify-between mb-5">
            <button
            onClick={resetOrdering}
              className="flex items-center gap-1 text-xs"
              style={{
                color: "#8A8478",
                ...monoStyle,
              }}
            >
              <ArrowLeft size={14} />
              table {selectedTable?.table_number}
            </button>

          <button
            onClick={resetOrdering}
            style={{
              color: "#C97C7C",
              ...monoStyle,
            }}
            className="text-[10px] uppercase"
          >
            reset
          </button>

            <span
              style={{
                ...monoStyle,
                color: "#C68A3F",
              }}
              className="text-xs"
            >
              {cartItems.reduce((sum, item) => sum + item.quantity, 0)} item(s)
            </span>
          </div>

          {groupedMenu.map((category) => {
            const SectionIcon =
              ICON_MAP[category.icon || "food"] || UtensilsCrossed;

            return (
              <div key={category.id} className="mb-7">
                <div className="flex items-center gap-2 mb-2">
                  <SectionIcon size={15} color="#C68A3F" />

                  <h3 className="text-sm font-semibold tracking-wide">
                    {category.name}
                  </h3>
                </div>

                <div className="flex flex-col gap-1">
                  {category.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        borderBottom: "1px dashed #3A3634",
                      }}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="pr-3">
                        <p className="text-sm">{item.name}</p>

                        {item.description && (
                          <p
                            style={{
                              color: "#6B655C",
                            }}
                            className="text-[10px] mt-0.5"
                          >
                            {item.description}
                          </p>
                        )}

                        <p
                          style={{
                            ...monoStyle,
                            color: "#8A8478",
                          }}
                          className="text-xs mt-1"
                        >
                          {money(item.price)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(cart[item.id] || 0) > 0 && (
                          <>
                            <button
                              onClick={() => addToCart(item.id, -1)}
                              style={{
                                border: "1px solid #3A3634",
                              }}
                              className="w-7 h-7 rounded-full flex items-center justify-center"
                            >
                              <Minus size={12} />
                            </button>

                            <span
                              style={monoStyle}
                              className="w-4 text-center text-sm"
                            >
                              {cart[item.id]}
                            </span>
                          </>
                        )}

                        <button
                          onClick={() => addToCart(item.id, 1)}
                          style={{
                            background: "#C68A3F",
                            color: "#211F1E",
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {cartItems.length > 0 && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              background: "#1A1817",
              borderTop: "1px solid #3A3634",
            }}
            className="px-5 py-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                style={{
                  ...monoStyle,
                  color: "#8A8478",
                }}
                className="text-xs"
              >
                Total
              </span>

              <span style={monoStyle} className="text-base font-medium">
                {money(cartTotal)}
              </span>
            </div>

            <button
              disabled={submitting}
              onClick={submitOrder}
              style={{
                background: submitting ? "#66502F" : "#C68A3F",
                color: "#211F1E",
                ...monoStyle,
              }}
              className="w-full py-3 rounded-sm text-sm font-medium flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}

              {submitting
                ? "Saving order..."
                : `Submit order · Table ${selectedTable?.table_number}`}
            </button>
          </div>
        )}
      </div>
    );
  }

  /*
   * ============================================================
   * CONFIRMED
   * ============================================================
   */

  if (role === "waiter" && view === "confirmed") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <div className="px-6 py-16 flex flex-col items-center text-center">
          <div
            style={{
              background: "#3F6B4F",
            }}
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          >
            <Check size={26} color="#F5EFE4" />
          </div>

          <p
            style={{
              ...monoStyle,
              color: "#C68A3F",
            }}
            className="text-xs mb-1"
          >
            ORDER #{orderNumber(confirmedOrder?.order_number)}
          </p>

          <h2 className="text-xl font-semibold mb-1">Order sent</h2>

          <p
            style={{
              color: "#8A8478",
            }}
            className="text-sm mb-8"
          >
            Table {confirmedOrder?.table?.table_number} · The order is now in
            the queue.
          </p>

          <div className="flex gap-3">
            <button
              onClick={resetOrdering}
              style={{
                border: "1px solid #3A3634",
                ...monoStyle,
              }}
              className="px-5 py-2 rounded-sm text-sm"
            >
              New order
            </button>

            <button
              onClick={() => setView("staff")}
              style={{
                background: "#C68A3F",
                color: "#211F1E",
                ...monoStyle,
              }}
              className="px-5 py-2 rounded-sm text-sm"
            >
              Queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * WAITER QUEUE
   * ============================================================
   */

  if (role === "waiter" && view === "staff") {
    const filteredOrders = orders.filter((order) => {
      if (staffFilter === "open") {
        return !isPaid(order);
      }

      if (staffFilter === "paid") {
        return isPaid(order);
      }

      if (staffFilter === "vip") {
        return order.order_source === "vip";
      }

      return true;
    });

    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} color="#C68A3F" />

              <h2 className="text-sm font-semibold">Order Queue</h2>
            </div>

            <div className="flex gap-1">
              {(["open", "paid", "vip", "all"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStaffFilter(filter)}
                  style={{
                    ...monoStyle,
                    background:
                      staffFilter === filter ? "#C68A3F" : "transparent",

                    color: staffFilter === filter ? "#211F1E" : "#8A8478",

                    border: "1px solid #3A3634",
                  }}
                  className="text-[10px] px-2 py-1 rounded-sm capitalize"
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 && (
            <p
              style={{
                color: "#6B655C",
              }}
              className="text-sm text-center py-12"
            >
              No orders in this view.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {filteredOrders.map((order) => {
              const payment = order.payments?.[order.payments.length - 1];

              return (
                <div
                  key={order.id}
                  style={{
                    border: isFlagged(order)
                      ? "1px solid #8B3A3A"
                      : "1px solid #3A3634",

                    background: "#1A1817",
                  }}
                  className="p-4 rounded-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      style={{
                        ...monoStyle,
                        color: "#C68A3F",
                      }}
                      className="text-xs"
                    >
                      #{orderNumber(order.order_number)} · table{" "}
                      {order.table?.table_number}
                    </span>

                    <span
                      style={{
                        ...monoStyle,
                        color: isPaid(order) ? "#3F6B4F" : "#B8763F",
                      }}
                      className="text-[10px] uppercase"
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span
                      style={{
                        color: "#8A8478",
                      }}
                      className="text-[11px]"
                    >
                      {order.waiter?.name} ·{" "}
                      {minutesBetween(order.created_at, now)} min ago
                    </span>

                    {isFlagged(order) && (
                      <span
                        style={{
                          color: "#C97C7C",
                          ...monoStyle,
                        }}
                        className="text-[10px] flex items-center gap-1"
                      >
                        <AlertTriangle size={11} />
                        review
                      </span>
                    )}
                  </div>

                  <div className="mb-3">
                    {(order.order_items || []).map((item) => (
                      <div
                        key={item.id || newLocalId()}
                        className="flex justify-between text-sm"
                        style={{
                          color: "#D8D3C8",
                        }}
                      >
                        <span>
                          {item.quantity}× {item.item_name}
                        </span>

                        <span style={monoStyle}>{money(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      borderTop: "1px dashed #3A3634",
                    }}
                    className="pt-2 flex items-center justify-between mb-3"
                  >
                    <span
                      className="text-xs"
                      style={{
                        color: "#8A8478",
                      }}
                    >
                      Total
                    </span>

                    <span style={monoStyle} className="text-sm font-medium">
                      {money(order.total)}
                    </span>
                  </div>

                  {!isPaid(order) && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        {PAY_METHODS.map((method) => (
                          <button
                            key={method.id}
                            onClick={() => markPaid(order, method.id)}
                            style={{
                              border: "1px solid #3A3634",
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-sm text-[10px]"
                          >
                            <method.icon size={12} />
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {payment && (
                    <p
                      style={{
                        color: "#6B655C",
                        ...monoStyle,
                      }}
                      className="text-[9px] mt-2"
                    >
                      Paid by {payment.method}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * INVENTORY
   * ============================================================
   */

  if (role === "accountant" && view === "inventory") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} color="#C68A3F" />

              <h2 className="text-sm font-semibold">Inventory</h2>
            </div>

            <button
              onClick={loadInventory}
              style={{
                color: "#8A8478",
              }}
              className="p-1"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <p
            style={{
              color: "#6B655C",
            }}
            className="text-[11px] mb-4"
          >
            Stock reduces automatically once an order for a linked menu item
            is marked paid. Use "Add Stock" when new supply comes in.
          </p>

          {unsyncedMenuItemsCount > 0 && (
            <button
              onClick={syncInventoryFromMenu}
              disabled={syncingInventory}
              style={{
                background: "#C68A3F",
                color: "#211F1E",
              }}
              className="w-full text-xs py-2.5 rounded-sm mb-4"
            >
              {syncingInventory
                ? "Syncing..."
                : `Add ${unsyncedMenuItemsCount} Menu Item${
                    unsyncedMenuItemsCount === 1 ? "" : "s"
                  } to Inventory`}
            </button>
          )}

          {lowStockItems.length > 0 && (
            <div
              style={{
                border: "1px solid #B8763F",
                background: "rgba(184,118,63,0.12)",
              }}
              className="p-3 rounded-sm mb-5 flex items-start gap-2"
            >
              <AlertTriangle size={16} color="#B8763F" className="mt-0.5 shrink-0" />

              <div>
                <p
                  style={{
                    color: "#B8763F",
                  }}
                  className="text-xs font-semibold mb-1"
                >
                  {lowStockItems.length} item
                  {lowStockItems.length === 1 ? "" : "s"} at or below the low
                  stock level
                </p>

                <p style={{ color: "#B8B2A8" }} className="text-[11px]">
                  {lowStockItems.map((item) => item.item_name).join(", ")}
                </p>
              </div>
            </div>
          )}

          {showNewInventoryForm ? (
            <div
              style={{
                border: "1px solid #3A3634",
                background: "#1A1817",
              }}
              className="p-3 rounded-sm mb-5"
            >
              <NewInventoryItemRow
                menuItems={menuItems}
                onCancel={() => setShowNewInventoryForm(false)}
                onCreate={async (...args) => {
                  await createInventoryItem(...args);
                  setShowNewInventoryForm(false);
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowNewInventoryForm(true)}
              style={{
                border: "1px dashed #3A3634",
                color: "#B8B2A8",
              }}
              className="w-full text-xs py-2 rounded-sm mb-5"
            >
              + New Inventory Item
            </button>
          )}

          <div className="flex flex-col gap-2">
            {inventoryItems.length === 0 && (
              <p style={{ color: "#6B655C" }} className="text-xs">
                No inventory items yet. Add one above.
              </p>
            )}

            {inventoryItems.map((item) => {
              const stock = currentStock(item);
              const isLow = stock <= item.low_stock_level;
              const isEditing = editingStockItem === item.id;
              const linkedMenuItem = menuItems.find(
                (menuItem) => menuItem.id === item.menu_item_id,
              );

              return (
                <div
                  key={item.id}
                  style={{
                    border: isLow ? "1px solid #B8763F" : "1px solid #3A3634",
                    background: "#1A1817",
                  }}
                  className="p-3 rounded-sm"
                >
                  {isEditing ? (
                    <StockEditRow
                      item={item}
                      menuItems={menuItems}
                      onCancel={() => setEditingStockItem(null)}
                      onSave={updateInventoryItem}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.item_name}</p>

                        <p style={{ color: "#6B655C" }} className="text-[10px]">
                          {linkedMenuItem
                            ? `Linked to ${linkedMenuItem.name}`
                            : "Not linked to a menu item"}
                        </p>
                      </div>

                      <span
                        style={{
                          ...monoStyle,
                          color: isLow ? "#B8763F" : "#B8B2A8",
                        }}
                        className="text-xs"
                      >
                        {stock} {item.unit}
                      </span>

                      <button
                        onClick={() => {
                          const amount = window.prompt(
                            `Add stock to "${item.item_name}". Current: ${stock} ${item.unit}`,
                            "1",
                          );

                          const parsed = Number(amount);

                          if (amount && !Number.isNaN(parsed) && parsed > 0) {
                            addStock(item, parsed);
                          }
                        }}
                        style={{
                          color: "#B8B2A8",
                          border: "1px solid #3A3634",
                        }}
                        className="text-[10px] px-2 py-1 rounded-sm"
                      >
                        Add Stock
                      </button>

                      <button
                        onClick={() => setEditingStockItem(item.id)}
                        style={{
                          color: "#B8B2A8",
                        }}
                        className="p-1"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        onClick={() => deleteInventoryItem(item)}
                        style={{
                          color: "#8A8478",
                        }}
                        className="p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ACCOUNTANT MENU MANAGEMENT
   * ============================================================
   */

  if (role === "accountant" && view === "menu-manage") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Pencil size={16} color="#C68A3F" />

              <h2 className="text-sm font-semibold">Manage Menu</h2>
            </div>

            <button
              onClick={loadMenu}
              style={{
                color: "#8A8478",
              }}
              className="p-1"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <p
            style={{
              color: "#6B655C",
            }}
            className="text-[11px] mb-5"
          >
            Changes are saved directly to the database. Waiters will see the
            updated menu.
          </p>

          {groupedMenu.map((category) => (
            <div key={category.id} className="mb-7">
              <h3
                className="text-sm font-semibold mb-2"
                style={{
                  color: "#C68A3F",
                }}
              >
                {category.name}
              </h3>

              <div className="flex flex-col gap-2 mb-3">
                {category.items.map((item) => {
                  const isEditing = editingItem === item.id;

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #3A3634",
                        background: "#1A1817",
                      }}
                      className="p-3 rounded-sm"
                    >
                      {isEditing ? (
                        <EditMenuItem
                          item={item}
                          onCancel={() => setEditingItem(null)}
                          onSave={updateMenuItem}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{item.name}</p>

                            {item.description && (
                              <p
                                style={{
                                  color: "#6B655C",
                                }}
                                className="text-[10px] truncate"
                              >
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end">
                            <span
                              style={{
                                ...monoStyle,
                                color: "#C68A3F",
                              }}
                              className="text-xs"
                            >
                              {money(item.price)}
                            </span>

                            <span
                              style={{
                                ...monoStyle,
                                color: "#6B655C",
                              }}
                              className="text-[9px]"
                            >
                              VIP {item.vip_multiplier}x ({money(item.price * item.vip_multiplier)})
                            </span>
                          </div>

                          <button
                            onClick={() => setEditingItem(item.id)}
                            style={{
                              color: "#B8B2A8",
                            }}
                            className="p-1"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            onClick={() => removeMenuItem(item)}
                            style={{
                              color: "#B8763F",
                            }}
                            className="p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  placeholder="New item name"
                  value={newItemDraft[category.id]?.name || ""}
                  onChange={(e) =>
                    setNewItemDraft((current) => ({
                      ...current,
                      [category.id]: {
                        ...(current[category.id] || {}),
                        name: e.target.value,
                      },
                    }))
                  }
                  style={inputStyle}
                  className="text-xs px-2 py-2 rounded-sm"
                />

                <div className="flex gap-2">
                  <input
                    placeholder="Description"
                    value={newItemDraft[category.id]?.description || ""}
                    onChange={(e) =>
                      setNewItemDraft((current) => ({
                        ...current,
                        [category.id]: {
                          ...(current[category.id] || {}),
                          description: e.target.value,
                        },
                      }))
                    }
                    style={inputStyle}
                    className="flex-1 text-xs px-2 py-2 rounded-sm"
                  />

                  <input
                    placeholder="Price"
                    type="number"
                    value={newItemDraft[category.id]?.price || ""}
                    onChange={(e) =>
                      setNewItemDraft((current) => ({
                        ...current,
                        [category.id]: {
                          ...(current[category.id] || {}),
                          price: e.target.value,
                        },
                      }))
                    }
                    style={inputStyle}
                    className="w-24 text-xs px-2 py-2 rounded-sm"
                  />

                  <input
                    placeholder="VIP x"
                    type="number"
                    step="0.05"
                    title="VIP price multiplier (e.g. 1.25, 1.5, 2)"
                    value={
                      newItemDraft[category.id]?.vipMultiplier ?? "2"
                    }
                    onChange={(e) =>
                      setNewItemDraft((current) => ({
                        ...current,
                        [category.id]: {
                          ...(current[category.id] || {}),
                          vipMultiplier: e.target.value,
                        },
                      }))
                    }
                    style={inputStyle}
                    className="w-16 text-xs px-2 py-2 rounded-sm"
                  />

                  <button
                    onClick={() => addMenuItem(category.id)}
                    style={{
                      background: "#C68A3F",
                      color: "#211F1E",
                    }}
                    className="px-3 rounded-sm"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ACCOUNTANT VIP MENU
   * ============================================================
   */

  if (role === "accountant" && view === "vip-menu") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 py-4 pb-16">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold">VIP Menu</h2>
          </div>

          <p
            style={{
              color: "#6B655C",
            }}
            className="text-[11px] mb-5"
          >
            Set what VIP customers pay for each item directly. Regular menu
            prices are shown for reference and aren't changed here.
          </p>

          {groupedMenu.map((category) => (
            <div key={category.id} className="mb-7">
              <h3
                className="text-sm font-semibold mb-2"
                style={{
                  color: "#C68A3F",
                }}
              >
                {category.name}
              </h3>

              <div className="flex flex-col gap-2">
                {category.items.map((item) => (
                  <VipPriceRow key={item.id} item={item} onSave={updateVipPrice} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ACCOUNTANT LEDGER
   * ============================================================
   */

  if (role === "accountant" && view === "ledger") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen size={16} color="#C68A3F" />

              <h2 className="text-sm font-semibold">Sales Ledger</h2>
            </div>

            <div className="flex gap-1">
              <button
                onClick={loadOrders}
                style={{
                  border: "1px solid #3A3634",
                }}
                className="p-2 rounded-sm"
              >
                <RefreshCw size={13} />
              </button>

              <button
                onClick={exportCSV}
                style={{
                  border: "1px solid #3A3634",
                  ...monoStyle,
                }}
                className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-sm text-[#B8B2A8]"
              >
                <Download size={12} />
                CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Paid orders" value={String(paidOrders.length)} />

            <StatCard
              label="Awaiting payment"
              value={String(awaitingPayment)}
            />

            <StatCard label="Total sales" value={money(totalSales)} accent />

            <StatCard
              label="Flagged"
              value={String(flaggedOrders.length)}
              danger={flaggedOrders.length > 0}
            />
          </div>

          <p
            style={{
              color: "#6B655C",
            }}
            className="text-[10px] mb-5"
          >
            Flagged orders are unpaid orders open for at least {FLAG_MINUTES}{" "}
            minutes.
          </p>

          <div className="mb-6">
            <p
              style={{
                color: "#8A8478",
              }}
              className="text-[11px] mb-2"
            >
              By payment method
            </p>

            <div className="flex flex-col gap-2">
              {byMethod.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className="flex items-center gap-1.5"
                    style={{
                      color: "#D8D3C8",
                    }}
                  >
                    <method.icon size={13} color="#8A8478" />

                    {method.label}
                  </span>

                  <span style={monoStyle}>{money(method.total)}</span>
                </div>
              ))}
            </div>
          </div>

          <p
            style={{
              color: "#8A8478",
            }}
            className="text-[11px] mb-2"
          >
            All records
          </p>

          <div className="flex flex-col gap-2">
            {orders.length === 0 && (
              <p
                style={{
                  color: "#6B655C",
                }}
                className="text-sm text-center py-8"
              >
                No records yet.
              </p>
            )}

            {orders.map((order) => {
              const payment = order.payments?.[order.payments.length - 1];

              return (
                <div
                  key={order.id}
                  style={{
                    borderBottom: "1px dashed #3A3634",

                    borderLeft: isFlagged(order) ? "2px solid #8B3A3A" : "none",

                    paddingLeft: isFlagged(order) ? "8px" : "0",
                  }}
                  className="py-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={monoStyle} className="text-xs">
                        #{orderNumber(order.order_number)} · table{" "}
                        {order.table?.table_number}
                      </p>

                      <p
                        style={{
                          color: "#6B655C",
                        }}
                        className="text-[10px]"
                      >
                        {order.waiter?.name} ·{" "}
                        {new Date(order.created_at).toLocaleString()}
                      </p>

                      <p
                        style={{
                          color: "#6B655C",
                        }}
                        className="text-[10px]"
                      >
                        Payment: {payment?.method || "unpaid"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p style={monoStyle} className="text-sm">
                        {money(order.total)}
                      </p>

                      <p
                        style={{
                          color:
                            isPaid(order)
                              ? "#3F6B4F"
                              : isFlagged(order)
                                ? "#C97C7C"
                                : "#B8763F",
                        }}
                        className="text-[10px] uppercase"
                      >
                        {isFlagged(order) ? "review" : order.status}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * UNEXPECTED VIEW/ROLE FALLBACK
   * ============================================================
   *
   * This replaces the old `return null`.
   * The application will NEVER silently become blank again.
   */

  return (
    <div
      style={shellStyle}
      className="staff-shell w-full min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center"
    >
      {fonts}

      <AlertTriangle size={40} color="#C68A3F" className="mb-4" />

      <h2 className="text-xl font-semibold mb-2">Something needs attention</h2>

      <p
        style={{
          color: "#8A8478",
        }}
        className="text-sm max-w-md mb-4"
      >
        Your account is signed in, but the application could not determine which
        screen to display.
      </p>

      <div
        style={{
          background: "#1A1817",
          border: "1px solid #3A3634",
        }}
        className="p-4 rounded-sm text-left max-w-md w-full mb-5"
      >
        <p
          style={{
            ...monoStyle,
            color: "#8A8478",
          }}
          className="text-[10px] mb-1"
        >
          ROLE
        </p>

        <p
          style={{
            ...monoStyle,
            color: "#C68A3F",
          }}
          className="text-xs mb-3"
        >
          {role || "not set"}
        </p>

        <p
          style={{
            ...monoStyle,
            color: "#8A8478",
          }}
          className="text-[10px] mb-1"
        >
          VIEW
        </p>

        <p
          style={{
            ...monoStyle,
            color: "#F5EFE4",
          }}
          className="text-xs"
        >
          {view}
        </p>
      </div>

      {error && (
        <p
          style={{
            color: "#C97C7C",
          }}
          className="text-xs max-w-md mb-5"
        >
          {error}
        </p>
      )}

      <button
        onClick={signOut}
        style={{
          background: "#C68A3F",
          color: "#211F1E",
          ...monoStyle,
        }}
        className="px-5 py-3 rounded-sm text-sm font-semibold"
      >
        Sign Out
      </button>
    </div>
  );
}

function VipPriceRow({
  item,
  onSave,
}: {
  item: MenuItem;
  onSave: (item: MenuItem, vipPriceInput: string) => void;
}) {
  const currentVipPrice = item.price * item.vip_multiplier;
  const [value, setValue] = useState(String(currentVipPrice));
  const [dirty, setDirty] = useState(false);

  return (
    <div
      style={{
        border: "1px solid #3A3634",
        background: "#1A1817",
      }}
      className="flex items-center gap-3 p-3 rounded-sm"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{item.name}</p>

        <p
          style={{
            color: "#6B655C",
            fontFamily: "var(--mono)",
          }}
          className="text-[10px]"
        >
          Regular: {money(item.price)}
        </p>
      </div>

      <input
        type="number"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        style={{
          background: "#211F1E",
          border: "1px solid #3A3634",
          color: "#F5EFE4",
          fontFamily: "var(--mono)",
        }}
        className="w-28 text-xs px-2 py-2 rounded-sm text-right"
        placeholder="VIP price"
      />

      <button
        onClick={() => {
          onSave(item, value);
          setDirty(false);
        }}
        disabled={!dirty}
        style={{
          background: dirty ? "#C68A3F" : "#3A3634",
          color: dirty ? "#211F1E" : "#6B655C",
        }}
        className="px-3 py-2 rounded-sm"
      >
        <Check size={14} />
      </button>
    </div>
  );
}

function StockEditRow({
  item,
  menuItems,
  onCancel,
  onSave,
}: {
  item: InventoryItem;
  menuItems: MenuItem[];
  onCancel: () => void;
  onSave: (
    item: InventoryItem,
    lowStockLevel: string,
    unit: string,
    menuItemId: string | null,
  ) => void;
}) {
  const [lowStockLevel, setLowStockLevel] = useState(
    String(item.low_stock_level),
  );

  const [unit, setUnit] = useState(item.unit);

  const [menuItemId, setMenuItemId] = useState<string>(
    item.menu_item_id || "",
  );

  const fieldStyle = {
    background: "#211F1E",
    border: "1px solid #3A3634",
    color: "#F5EFE4",
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{item.item_name}</p>

      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
            Unit
          </p>

          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={fieldStyle}
            className="w-full text-xs px-2 py-2 rounded-sm"
          />
        </div>

        <div className="flex-1">
          <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
            Low stock level
          </p>

          <input
            type="number"
            value={lowStockLevel}
            onChange={(e) => setLowStockLevel(e.target.value)}
            style={{ ...fieldStyle, fontFamily: "var(--mono)" }}
            className="w-full text-xs px-2 py-2 rounded-sm"
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
          Linked menu item
        </p>

        <select
          value={menuItemId}
          onChange={(e) => setMenuItemId(e.target.value)}
          style={fieldStyle}
          className="w-full text-xs px-2 py-2 rounded-sm"
        >
          <option value="">Not linked</option>
          {menuItems.map((menuItem) => (
            <option key={menuItem.id} value={menuItem.id}>
              {menuItem.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() =>
            onSave(item, lowStockLevel, unit, menuItemId || null)
          }
          style={{
            background: "#C68A3F",
            color: "#211F1E",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Save
        </button>

        <button
          onClick={onCancel}
          style={{
            border: "1px solid #3A3634",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function NewInventoryItemRow({
  menuItems,
  onCancel,
  onCreate,
}: {
  menuItems: MenuItem[];
  onCancel: () => void;
  onCreate: (
    itemName: string,
    unit: string,
    openingStock: string,
    lowStockLevel: string,
    menuItemId: string | null,
  ) => void;
}) {
  const [itemName, setItemName] = useState("");
  const [unit, setUnit] = useState("pieces");
  const [openingStock, setOpeningStock] = useState("0");
  const [lowStockLevel, setLowStockLevel] = useState("0");
  const [menuItemId, setMenuItemId] = useState("");

  const fieldStyle = {
    background: "#211F1E",
    border: "1px solid #3A3634",
    color: "#F5EFE4",
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
          Item name
        </p>

        <input
          type="text"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="e.g. Star Beer (bottle)"
          style={fieldStyle}
          className="w-full text-xs px-2 py-2 rounded-sm"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
            Unit
          </p>

          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={fieldStyle}
            className="w-full text-xs px-2 py-2 rounded-sm"
          />
        </div>

        <div className="flex-1">
          <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
            Opening stock
          </p>

          <input
            type="number"
            value={openingStock}
            onChange={(e) => setOpeningStock(e.target.value)}
            style={{ ...fieldStyle, fontFamily: "var(--mono)" }}
            className="w-full text-xs px-2 py-2 rounded-sm"
          />
        </div>

        <div className="flex-1">
          <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
            Low stock level
          </p>

          <input
            type="number"
            value={lowStockLevel}
            onChange={(e) => setLowStockLevel(e.target.value)}
            style={{ ...fieldStyle, fontFamily: "var(--mono)" }}
            className="w-full text-xs px-2 py-2 rounded-sm"
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
          Linked menu item (optional)
        </p>

        <select
          value={menuItemId}
          onChange={(e) => setMenuItemId(e.target.value)}
          style={fieldStyle}
          className="w-full text-xs px-2 py-2 rounded-sm"
        >
          <option value="">Not linked</option>
          {menuItems.map((menuItem) => (
            <option key={menuItem.id} value={menuItem.id}>
              {menuItem.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() =>
            onCreate(itemName, unit, openingStock, lowStockLevel, menuItemId || null)
          }
          style={{
            background: "#C68A3F",
            color: "#211F1E",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Create
        </button>

        <button
          onClick={onCancel}
          style={{
            border: "1px solid #3A3634",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditMenuItem({
  item,
  onCancel,
  onSave,
}: {
  item: MenuItem;
  onCancel: () => void;
  onSave: (
    item: MenuItem,
    name: string,
    price: string,
    description: string,
    vipMultiplier: string,
  ) => void;
}) {
  const [name, setName] = useState(item.name);

  const [price, setPrice] = useState(String(item.price));

  const [description, setDescription] = useState(item.description || "");

  const [vipMultiplier, setVipMultiplier] = useState(String(item.vip_multiplier ?? 2));

  return (
    <div className="flex flex-col gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          background: "#211F1E",
          border: "1px solid #3A3634",
          color: "#F5EFE4",
        }}
        className="text-sm px-2 py-2 rounded-sm"
        placeholder="Item name"
      />

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{
          background: "#211F1E",
          border: "1px solid #3A3634",
          color: "#F5EFE4",
        }}
        className="text-xs px-2 py-2 rounded-sm"
        placeholder="Description"
      />

      <div className="flex gap-2">
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={{
            background: "#211F1E",
            border: "1px solid #3A3634",
            color: "#F5EFE4",

            fontFamily: "var(--mono)",
          }}
          className="flex-1 text-xs px-2 py-2 rounded-sm"
          placeholder="Price"
        />

        <input
          type="number"
          step="0.05"
          value={vipMultiplier}
          onChange={(e) => setVipMultiplier(e.target.value)}
          style={{
            background: "#211F1E",
            border: "1px solid #3A3634",
            color: "#F5EFE4",

            fontFamily: "var(--mono)",
          }}
          className="w-20 text-xs px-2 py-2 rounded-sm"
          placeholder="VIP x"
          title="VIP price multiplier (e.g. 1.25, 1.5, 2)"
        />
      </div>

      <p
        style={{
          color: "#6B655C",
          fontFamily: "var(--mono)",
        }}
        className="text-[10px]"
      >
        VIP price preview:{" "}
        {money(Number(price || 0) * Number(vipMultiplier || 0))}
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(item, name, price, description, vipMultiplier)}
          style={{
            background: "#C68A3F",
            color: "#211F1E",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Save
        </button>

        <button
          onClick={onCancel}
          style={{
            border: "1px solid #3A3634",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Beer,
  Martini,
  UtensilsCrossed,
  Wine,
  Plus,
  Minus,
  Receipt,
  ClipboardList,
  BookOpen,
  Check,
  Banknote,
  CreditCard,
  Smartphone,
  ArrowLeft,
  Download,
  Calculator,
  Loader2,
  AlertTriangle,
  QrCode,
  Pencil,
  Trash2,
  RefreshCw,
  LogOut,
  Lock,
  UserPlus,
  X,
  Bell,
  BellOff,
} from "lucide-react";
import { supabase, supabaseConfigError } from "./supabase";
import type { Session } from "@supabase/supabase-js";

const ICON_MAP: Record<string, any> = {
  beer: Beer,
  martini: Martini,
  wine: Wine,
  food: UtensilsCrossed,
};

const PAY_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "POS", icon: CreditCard },
  { id: "transfer", label: "Transfer", icon: Smartphone },
];

const FLAG_MINUTES = 55;

const VAPID_PUBLIC_KEY =
  "BO2BNg6rRRW2HCoY7aDop6Kel3hCuSlx7sPL8b55H8THVCOaG516SZlmwgOB3icdqwriFxY3svM50D-f8ZnefJE";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Profile = {
  id: string;
  name: string;
  role: string;
  active?: boolean;
  created_at?: string;
};

type Table = {
  id: number;
  table_number: number;
  active: boolean;
};

type MenuCategory = {
  id: number;
  name: string;
  icon: string | null;
  display_order: number;
  active: boolean;
  created_at?: string;
};

type MenuItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  vip_multiplier: number;
  active: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
};

type InventoryItem = {
  id: string;
  item_name: string;
  unit: string;
  opening_stock: number;
  stock_in: number;
  stock_used: number;
  low_stock_level: number;
  menu_item_id: string | null;
  created_at?: string;
  updated_at?: string;
};

function normalizeInventoryItem(item: any): InventoryItem {
  return {
    id: String(item.id),
    item_name: String(item.item_name || "").trim(),
    unit: String(item.unit || "pieces"),
    opening_stock: Number(item.opening_stock ?? 0),
    stock_in: Number(item.stock_in ?? 0),
    stock_used: Number(item.stock_used ?? 0),
    low_stock_level: Number(item.low_stock_level ?? 0),
    menu_item_id: item.menu_item_id ? String(item.menu_item_id) : null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function currentStock(item: InventoryItem) {
  return item.opening_stock + item.stock_in - item.stock_used;
}

type CartItem = MenuItem & { quantity: number };

type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type Order = {
  id: string;
  order_number?: number | string;
  table_id?: number;
  waiter_id: string | null;
  order_source?: string | null;
  status: string;
  payment_status?: string | null;
  payment_method?: string | null;
  total: number;
  created_at: string;
  paid_at: string | null;
  table?: Table;
  waiter?: Profile;
  order_items?: OrderItem[];
  payments?: Payment[];
};

type Payment = {
  id: string;
  order_id: string;
  method: string;
  amount: number;
  confirmed_by: string | null;
  created_at: string;
};

const DEFAULT_TABLES: Table[] = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1,
  table_number: index + 1,
  active: true,
}));

function money(value: number) {
  return `₦${Number(value || 0).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function minutesBetween(start: string, end: Date) {
  return Math.round((end.getTime() - new Date(start).getTime()) / 60000);
}

function orderNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "------";
  }

  const numericValue = Number(value);

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return String(numericValue).padStart(4, "0");
  }

  return String(value).slice(0, 6).toUpperCase();
}

function newLocalId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeMenuItem(item: any): MenuItem {
  return {
    id: String(item.id),
    category: String(item.category || "Other").trim() || "Other",
    name: String(item.name || "").trim(),
    description: item.description ?? null,
    price: Number(item.price || 0),
    vip_multiplier: Number(item.vip_multiplier ?? 2),
    active: Boolean(item.available ?? item.active ?? true),
    display_order: Number(item.display_order || 0),
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

function isPaid(order: Order) {
  return order.payment_status === "paid" || order.status === "paid";
}

function StatCard({
  label,
  value,
  accent = false,
  danger = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #3A3634",
        background: "#1A1817",
      }}
      className="rounded-sm p-3"
    >
      <p
        style={{
          color: "#8A8478",
          ...{ fontFamily: "var(--mono)" },
        }}
        className="text-[10px] uppercase"
      >
        {label}
      </p>
      <p
        style={{
          color: danger ? "#C97C7C" : accent ? "#C68A3F" : "#F5EFE4",
          fontFamily: "var(--mono)",
        }}
        className="text-lg font-semibold mt-1"
      >
        {value}
      </p>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState("landing");

  const [tables, setTables] = useState<Table[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const [staffFilter, setStaffFilter] = useState<
    "open" | "paid" | "all" | "vip"
  >("open");

  const [now, setNow] = useState(new Date());

  const [editingItem, setEditingItem] = useState<string | null>(null);

  const [editingStockItem, setEditingStockItem] = useState<string | null>(null);

  const [showNewInventoryForm, setShowNewInventoryForm] = useState(false);

  const [syncingInventory, setSyncingInventory] = useState(false);

  const [newItemDraft, setNewItemDraft] = useState<
    Record<
      number,
      { name: string; price: string; description: string; vipMultiplier: string }
    >
  >({});

  // Auth form state
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authRole, setAuthRole] = useState<"waiter" | "accountant">("waiter");
  const [authLoading, setAuthLoading] = useState(false);

  const role = profile?.role ?? null;

  /*
   * ============================================================
   * AUTH
   * ============================================================
   */

  async function loadProfile(userId: string) {
    try {
      setError("");

      console.log("Loading profile for Auth user:", userId);

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("id, name:full_name, role, created_at")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        console.error("PROFILE ERROR:", profileError);

        setProfile(null);
        setError(`Could not load your profile: ${profileError.message}`);

        return;
      }

      if (!data) {
        console.error("NO PROFILE FOUND FOR USER:", userId);

        setProfile(null);
        setError(
          "Your login worked, but no staff profile was found for this account.",
        );

        return;
      }

      console.log("Profile loaded:", data);

      setProfile(data as Profile);

      if (data.role === "accountant") {
        setView("ledger");
      } else if (data.role === "waiter") {
        setView("landing");
      } else {
        setError(
          `Your profile has an invalid role: "${data.role}". Set the role to "waiter" or "accountant" in the profiles table.`,
        );
      }
    } catch (err: any) {
      console.error("LOAD PROFILE ERROR:", err);

      setProfile(null);
      setError(err?.message || "Something went wrong loading your profile.");
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      checkPushSubscription();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    let mounted = true;

    if (supabaseConfigError) {
      setError(supabaseConfigError);
      setSession(null);
      setProfile(null);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    async function initializeAuth() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        setSession(currentSession);

        if (currentSession) {
          await loadProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (err: any) {
        console.error("AUTH INITIALIZATION ERROR:", err);

        if (mounted) {
          setError(err?.message || "Could not initialize authentication.");
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;

      setSession(newSession);

      if (!newSession) {
        setProfile(null);
        setView("landing");
        setLoading(false);
        return;
      }

      setLoading(true);

      await loadProfile(newSession.user.id);

      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();

    if (!authEmail.trim() || !authPassword) {
      setError("Enter your email and password.");
      return;
    }

    setAuthLoading(true);
    setError("");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (signInError) {
        throw signInError;
      }
    } catch (err: any) {
      console.error("SIGN IN ERROR:", err);

      setError(
        err?.message || "Sign in failed. Check your email and password.",
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();

    if (!authName.trim() || !authEmail.trim() || !authPassword) {
      setError("Please complete all fields.");
      return;
    }

    if (authPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setAuthLoading(true);
    setError("");

    try {
      const { data, error: signupError } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
        options: {
          data: {
            full_name: authName.trim(),
            role: authRole,
          },
        },
      });

      if (signupError) {
        console.error("Signup error:", signupError);
        setError(signupError.message);
        return;
      }

      if (data.user) {
        setError(
          "Account created successfully. Please check the email for verification if required.",
        );
      }
    } catch (err) {
      console.error("Unexpected signup error:", err);
      setError("Something went wrong while creating the account.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function checkPushSubscription() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      setPushEnabled(!!existing);
    } catch (err) {
      console.error("PUSH CHECK ERROR:", err);
    }
  }

  async function enablePushNotifications() {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setError("Push notifications aren't supported on this browser/device.");
        return;
      }

      if (!session?.user?.id) {
        setError("Sign in before enabling notifications.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      const json = subscription.toJSON();

      const { error: upsertError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            staff_id: session.user.id,
            endpoint: json.endpoint,
            p256dh: json.keys?.p256dh,
            auth: json.keys?.auth,
          },
          { onConflict: "endpoint" },
        );

      if (upsertError) throw upsertError;

      setPushEnabled(true);
    } catch (err: any) {
      console.error("PUSH SUBSCRIBE ERROR:", err);
      setError(err.message || "Could not enable notifications.");
    }
  }

  async function disablePushNotifications() {
    try {
      if (!("serviceWorker" in navigator)) return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);

        await subscription.unsubscribe();
      }

      setPushEnabled(false);
    } catch (err: any) {
      console.error("PUSH UNSUBSCRIBE ERROR:", err);
      setError(err.message || "Could not disable notifications.");
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("SIGN OUT ERROR:", err);
    }

    setProfile(null);
    setSession(null);
    setView("landing");
    setCart({});
    setSelectedTable(null);
    setConfirmedOrder(null);

    setAuthEmail("");
    setAuthPassword("");
    setAuthName("");
    setAuthMode("signin");
    setError("");
  }

  /*
   * ============================================================
   * LOAD DATABASE
   * ============================================================
   */

  async function loadTables() {
    const { data, error } = await supabase
      .from("bar_tables")
      .select("*")
      .eq("active", true)
      .order("table_number");

    if (error || !data?.length) {
      console.warn(
        "bar_tables is unavailable; using the standard table selector.",
        error?.message,
      );
      setTables(DEFAULT_TABLES);
      return;
    }

    setTables(data as Table[]);
  }

  async function loadMenu() {
    try {
      const itemResult = await supabase
        .from("menu_items")
        .select(
          "id, name, category, price, vip_multiplier, description, available, created_at, updated_at",
        )
        .eq("available", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (itemResult.error) throw itemResult.error;

      const itemData = (itemResult.data || []).map(normalizeMenuItem);
      const categoryNames = Array.from(
        new Set(itemData.map((item) => item.category)),
      );
      const categoryData: MenuCategory[] = categoryNames.map((name, index) => ({
        id: index + 1,
        name,
        icon: null,
        display_order: index,
        active: true,
      }));

      setCategories(categoryData);
      setMenuItems(itemData);
    } catch (err: any) {
      console.error("LOAD MENU ERROR:", err);
      throw err;
    }
  }

  async function loadInventory() {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .order("item_name", { ascending: true });

      if (error) throw error;

      setInventoryItems((data || []).map(normalizeInventoryItem));
    } catch (err: any) {
      console.error("LOAD INVENTORY ERROR:", err);
      throw err;
    }
  }
  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        *,
        waiter:profiles(id, full_name, role, created_at),
        order_items(*)
      `,
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    const normalizedOrders = (data || []).map((rawOrder: any) => {
      const tableMatch = String(rawOrder.notes || "").match(/table\s+(\d+)/i);
      const tableNumber = tableMatch ? Number(tableMatch[1]) : undefined;
      const paymentTimestamp =
        rawOrder.payment_status === "paid"
          ? rawOrder.updated_at || rawOrder.created_at
          : null;

      return {
        ...rawOrder,
        id: String(rawOrder.id),
        order_number: rawOrder.order_number ?? String(rawOrder.id),
        table_id: tableNumber,
        table: tableNumber
          ? {
              id: tableNumber,
              table_number: tableNumber,
              active: true,
            }
          : undefined,
        waiter: rawOrder.waiter
          ? {
              id: rawOrder.waiter.id,
              name: rawOrder.waiter.full_name,
              role: rawOrder.waiter.role,
              created_at: rawOrder.waiter.created_at,
            }
          : undefined,
        order_items: (rawOrder.order_items || []).map((item: any) => ({
          ...item,
          id: String(item.id),
          order_id: String(item.order_id),
          menu_item_id: item.menu_item_id ? String(item.menu_item_id) : "",
          unit_price: Number(item.unit_price || 0),
          subtotal: Number(item.total_price ?? item.subtotal ?? 0),
        })),
        total: Number(rawOrder.total || 0),
        paid_at: paymentTimestamp,
        payments: rawOrder.payment_method
          ? [
              {
                id: `${rawOrder.id}-payment`,
                order_id: String(rawOrder.id),
                method: rawOrder.payment_method,
                amount: Number(rawOrder.total || 0),
                confirmed_by: null,
                created_at: paymentTimestamp || rawOrder.updated_at,
              },
            ]
          : [],
      } as Order;
    });

    setOrders(normalizedOrders);
  }

  async function loadEverything() {
    try {
      setLoading(true);
      setError("");

      await Promise.all([loadTables(), loadMenu(), loadOrders(), loadInventory()]);
    } catch (err: any) {
      console.error("DATABASE LOAD ERROR:", err);

      setError(err?.message || "Could not load data from the database.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session && profile) {
      loadEverything();
    }
  }, [session?.user.id, profile?.id]);

  /*
   * ============================================================
   * REAL-TIME NEW ORDER NOTIFICATIONS
   * Plays a generated tone (no audio file needed) and shows an
   * on-screen banner the instant a new order is inserted, using
   * Supabase Realtime — no manual refresh required.
   * ============================================================
   */

  function playNotificationSound() {
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();

      const playBeep = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.value = freq;

        gain.gain.setValueAtTime(0, ctx.currentTime + start);
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
        gain.gain.linearRampToValueAtTime(
          0,
          ctx.currentTime + start + duration,
        );

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playBeep(880, 0, 0.15);
      playBeep(1108, 0.18, 0.2);
    } catch (err) {
      console.error("Notification sound error:", err);
    }
  }

  function showNewOrderToast(message: string) {
    const toast = document.createElement("div");
    toast.textContent = message;

    Object.assign(toast.style, {
      position: "fixed",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%) translateY(-20px)",
      background: "#C68A3F",
      color: "#211F1E",
      padding: "14px 22px",
      borderRadius: "10px",
      fontWeight: "700",
      fontSize: "14px",
      zIndex: "99999",
      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      opacity: "0",
      transition: "opacity 0.25s ease, transform 0.25s ease",
      maxWidth: "90vw",
      textAlign: "center",
    });

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(-50%) translateY(0)";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(-50%) translateY(-20px)";
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  useEffect(() => {
    if (!session || !profile) return;

    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const newOrder = payload.new as any;
          const isVip = newOrder.order_source === "vip";
          const amount = Number(newOrder.total || 0);

          playNotificationSound();

          showNewOrderToast(
            isVip
              ? `New VIP order — ₦${amount.toLocaleString()}`
              : `New order #${newOrder.order_number} — ₦${amount.toLocaleString()}`,
          );

          loadOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user.id, profile?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  /*
   * ============================================================
   * MENU
   * ============================================================
   */

  const groupedMenu = useMemo(() => {
    return categories.map((category) => ({
      ...category,
      items: menuItems
        .filter(
          (item) =>
            (item.category || "").trim().toLowerCase() ===
            (category.name || "").trim().toLowerCase(),
        )
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
    }));
  }, [categories, menuItems]);

  const lowStockItems = useMemo(() => {
    return inventoryItems
      .filter((item) => currentStock(item) <= item.low_stock_level)
      .sort((a, b) => currentStock(a) - currentStock(b));
  }, [inventoryItems]);

  const unsyncedMenuItemsCount = useMemo(() => {
    const linkedMenuItemIds = new Set(
      inventoryItems
        .map((item) => item.menu_item_id)
        .filter((id): id is string => Boolean(id)),
    );

    return menuItems.filter((menuItem) => !linkedMenuItemIds.has(menuItem.id))
      .length;
  }, [inventoryItems, menuItems]);

  const cartItems = useMemo<CartItem[]>(() => {
    return Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([id, quantity]) => {
        const item = menuItems.find((menuItem) => menuItem.id === id);

        if (!item) return null;

        return {
          ...item,
          quantity,
        };
      })
      .filter(Boolean) as CartItem[];
  }, [cart, menuItems]);

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  function addToCart(itemId: string, amount: number) {
    setCart((current) => ({
      ...current,
      [itemId]: Math.max(0, (current[itemId] || 0) + amount),
    }));
  }

  function resetOrdering() {
    setSelectedTable(null);
    setCart({});
    setConfirmedOrder(null);
    setError("");
    setView("table-select");
  }

  /*
   * ============================================================
   * ORDERS
   * ============================================================
   */

  async function submitOrder() {
    if (!session) {
      setError("You must be signed in.");
      return;
    }

    if (!selectedTable) {
      setError("Please select a table.");
      return;
    }

    if (cartItems.length === 0) {
      setError("Please add at least one item.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const { data: createdOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_type: "staff",
          waiter_id: session.user.id,
          status: "pending",
          payment_status: "unpaid",
          subtotal: cartTotal,
          total: cartTotal,
          notes: `Table ${selectedTable.table_number}`,
        })
        .select("*")
        .single();

      if (orderError) throw orderError;

      const orderItems = cartItems.map((item) => ({
        id: newLocalId(),
        order_id: String(createdOrder.id),
        menu_item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity,
      }));

      const { error: itemError } = await supabase
        .from("order_items")
        .insert(
          orderItems.map(({ subtotal: _subtotal, id: _id, ...item }) => item),
        );

      if (itemError) {
        await supabase.from("orders").delete().eq("id", createdOrder.id);

        throw itemError;
      }

      const completeOrder: Order = {
        ...createdOrder,
        id: String(createdOrder.id),
        order_number: String(createdOrder.id),
        table_id: selectedTable.table_number,
        status: "pending",
        payment_status: "unpaid",
        paid_at: null,
        table: selectedTable,
        waiter: profile || undefined,
        order_items: orderItems.map(
          (item, index) =>
            ({
              ...item,
              id: String(index + 1),
            }) as OrderItem,
        ),
        payments: [],
      };

      setOrders((current) => [completeOrder, ...current]);

      setConfirmedOrder(completeOrder);

      setCart({});
      setView("confirmed");
    } catch (err: any) {
      console.error("SUBMIT ORDER ERROR:", err);

      setError(
        err?.message || "The order could not be saved. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * ============================================================
   * PAYMENTS
   * ============================================================
   */

  async function markPaid(order: Order, method: string) {
    if (!session) {
      setError("You must be signed in.");
      return;
    }

    try {
      setError("");

      const paidAt = new Date().toISOString();

      const { error: orderError } = await supabase
        .from("orders")
        .update({
          payment_method: method,
          payment_status: "paid",
          status: "received",
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                payment_method: method,
                payment_status: "paid",
                status: "received",
                paid_at: paidAt,
                payments: [
                  ...(item.payments || []),
                  {
                    id: `${item.id}-payment`,
                    order_id: order.id,
                    method,
                    amount: order.total,
                    confirmed_by: session.user.id,
                    created_at: paidAt,
                  },
                ],
              }
            : item,
        ),
      );
    } catch (err: any) {
      console.error("PAYMENT ERROR:", err);

      setError(err?.message || "Payment could not be recorded.");
    }
  }

  /*
   * ============================================================
   * MENU MANAGEMENT
   * ============================================================
   */

  async function updateMenuItem(
    item: MenuItem,
    name: string,
    price: string,
    description: string,
    vipMultiplier: string,
  ) {
    const parsedPrice = Number(price);
    const parsedMultiplier = Number(vipMultiplier);

    if (!name.trim()) {
      setError("Item name cannot be empty.");
      return;
    }

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Enter a valid price.");
      return;
    }

    if (Number.isNaN(parsedMultiplier) || parsedMultiplier <= 0) {
      setError("Enter a valid VIP multiplier (e.g. 1.25, 1.5, 2).");
      return;
    }

    try {
      setError("");

      const { data, error } = await supabase
        .from("menu_items")
        .update({
          name: name.trim(),
          price: parsedPrice,
          vip_multiplier: parsedMultiplier,
          description: description.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .select("*")
        .single();

      if (error) throw error;

      setMenuItems((current) =>
        current.map((menuItem) =>
          menuItem.id === item.id ? normalizeMenuItem(data) : menuItem,
        ),
      );

      setEditingItem(null);
    } catch (err: any) {
      console.error("UPDATE MENU ERROR:", err);

      setError(err?.message || "The menu item could not be updated.");
    }
  }

  async function updateVipPrice(item: MenuItem, vipPriceInput: string) {
    const vipPrice = Number(vipPriceInput);

    if (Number.isNaN(vipPrice) || vipPrice < 0) {
      setError("Enter a valid VIP price.");
      return;
    }

    if (!item.price || item.price <= 0) {
      setError(
        `"${item.name}" has no regular price set, so a VIP multiplier can't be calculated.`,
      );
      return;
    }

    const multiplier = vipPrice / item.price;

    try {
      setError("");

      const { data, error } = await supabase
        .from("menu_items")
        .update({
          vip_multiplier: multiplier,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .select("*")
        .single();

      if (error) throw error;

      setMenuItems((current) =>
        current.map((menuItem) =>
          menuItem.id === item.id ? normalizeMenuItem(data) : menuItem,
        ),
      );
    } catch (err: any) {
      console.error("UPDATE VIP PRICE ERROR:", err);
      setError(err?.message || "The VIP price could not be updated.");
    }
  }

  const removeMenuItem = async (item: MenuItem) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${item.name}"?`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", item.id);

      if (error) {
        console.error("Delete menu item error:", error);
        alert(`Could not delete "${item.name}": ${error.message}`);
        return;
      }

      setMenuItems((prev) =>
        prev.filter((menuItem) => menuItem.id !== item.id),
      );

      alert(`"${item.name}" has been deleted.`);
    } catch (err) {
      console.error("Unexpected delete error:", err);
      alert("Something went wrong while deleting the menu item.");
    }
  };

  async function createInventoryItem(
    itemName: string,
    unit: string,
    openingStock: string,
    lowStockLevel: string,
    menuItemId: string | null,
  ) {
    if (!itemName.trim()) {
      setError("Enter an item name.");
      return;
    }

    const parsedOpening = Number(openingStock);
    const parsedLow = Number(lowStockLevel);

    if (Number.isNaN(parsedOpening) || parsedOpening < 0) {
      setError("Enter a valid opening stock.");
      return;
    }

    if (Number.isNaN(parsedLow) || parsedLow < 0) {
      setError("Enter a valid low stock level.");
      return;
    }

    try {
      setError("");

      const { data, error } = await supabase
        .from("inventory")
        .insert({
          item_name: itemName.trim(),
          unit: unit.trim() || "pieces",
          opening_stock: parsedOpening,
          stock_in: 0,
          stock_used: 0,
          low_stock_level: parsedLow,
          menu_item_id: menuItemId,
        })
        .select("*")
        .single();

      if (error) throw error;

      setInventoryItems((current) =>
        [...current, normalizeInventoryItem(data)].sort((a, b) =>
          a.item_name.localeCompare(b.item_name),
        ),
      );
    } catch (err: any) {
      console.error("CREATE INVENTORY ITEM ERROR:", err);

      setError(err?.message || "Inventory item could not be created.");
    }
  }

  async function updateInventoryItem(
    item: InventoryItem,
    lowStockLevel: string,
    unit: string,
    menuItemId: string | null,
  ) {
    const parsedLow = Number(lowStockLevel);

    if (Number.isNaN(parsedLow) || parsedLow < 0) {
      setError("Enter a valid low stock level.");
      return;
    }

    try {
      setError("");

      const { data, error } = await supabase
        .from("inventory")
        .update({
          low_stock_level: parsedLow,
          unit: unit.trim() || "pieces",
          menu_item_id: menuItemId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .select("*")
        .single();

      if (error) throw error;

      setInventoryItems((current) =>
        current.map((invItem) =>
          invItem.id === item.id ? normalizeInventoryItem(data) : invItem,
        ),
      );

      setEditingStockItem(null);
    } catch (err: any) {
      console.error("UPDATE INVENTORY ITEM ERROR:", err);

      setError(err?.message || "Inventory item could not be updated.");
    }
  }

  async function addStock(item: InventoryItem, addQuantity: number) {
    if (!addQuantity || addQuantity <= 0) return;

    try {
      setError("");

      const newStockIn = item.stock_in + addQuantity;

      const { data, error } = await supabase
        .from("inventory")
        .update({
          stock_in: newStockIn,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id)
        .select("*")
        .single();

      if (error) throw error;

      setInventoryItems((current) =>
        current.map((invItem) =>
          invItem.id === item.id ? normalizeInventoryItem(data) : invItem,
        ),
      );
    } catch (err: any) {
      console.error("ADD STOCK ERROR:", err);

      setError(err?.message || "Stock could not be added.");
    }
  }

  async function deleteInventoryItem(item: InventoryItem) {
    const confirmed = window.confirm(
      `Delete "${item.item_name}" from inventory? This cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setError("");

      const { error } = await supabase
        .from("inventory")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      setInventoryItems((current) =>
        current.filter((invItem) => invItem.id !== item.id),
      );
    } catch (err: any) {
      console.error("DELETE INVENTORY ITEM ERROR:", err);

      setError(err?.message || "Inventory item could not be deleted.");
    }
  }

  async function syncInventoryFromMenu() {
    try {
      setError("");
      setSyncingInventory(true);

      const linkedMenuItemIds = new Set(
        inventoryItems
          .map((item) => item.menu_item_id)
          .filter((id): id is string => Boolean(id)),
      );

      const unlinkedMenuItems = menuItems.filter(
        (menuItem) => !linkedMenuItemIds.has(menuItem.id),
      );

      if (unlinkedMenuItems.length === 0) {
        setSyncingInventory(false);
        return;
      }

      const rows = unlinkedMenuItems.map((menuItem) => ({
        item_name: menuItem.name,
        unit: "pieces",
        opening_stock: 0,
        stock_in: 0,
        stock_used: 0,
        low_stock_level: 0,
        menu_item_id: menuItem.id,
      }));

      const { data, error } = await supabase
        .from("inventory")
        .insert(rows)
        .select("*");

      if (error) throw error;

      setInventoryItems((current) =>
        [...current, ...(data || []).map(normalizeInventoryItem)].sort(
          (a, b) => a.item_name.localeCompare(b.item_name),
        ),
      );
    } catch (err: any) {
      console.error("SYNC INVENTORY ERROR:", err);

      setError(err?.message || "Could not sync menu items into inventory.");
    } finally {
      setSyncingInventory(false);
    }
  }

  const addMenuItem = async (categoryId: number) => {
    const draft = newItemDraft[categoryId] || {
      name: "",
      price: "",
      description: "",
      vipMultiplier: "2",
    };

    if (!draft.name.trim()) {
      alert("Please enter the menu item name.");
      return;
    }

    if (!draft.price || Number(draft.price) <= 0) {
      alert("Please enter a valid price.");
      return;
    }

    const vipMultiplier = Number(draft.vipMultiplier);
    if (!draft.vipMultiplier || Number.isNaN(vipMultiplier) || vipMultiplier <= 0) {
      alert("Please enter a valid VIP multiplier (e.g. 1.25, 1.5, 2).");
      return;
    }

    const categoryName =
      categories.find((category) => category.id === categoryId)?.name?.trim() || "";

    if (!categoryName) {
      alert("Please select a valid menu category.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("menu_items")
        .insert({
          category: categoryName,
          name: draft.name.trim(),
          description: draft.description?.trim() || null,
          price: Number(draft.price),
          vip_multiplier: vipMultiplier,
          available: true,
        })
        .select()
        .single();

      if (error) {
        console.error("Add menu item error:", error);
        alert(`Could not add menu item: ${error.message}`);
        return;
      }

      if (!data) {
        alert("Menu item was not created.");
        return;
      }

      setMenuItems((prev) => [...prev, normalizeMenuItem(data)]);

      setNewItemDraft((current) => ({
        ...current,
        [categoryId]: { name: "", price: "", description: "", vipMultiplier: "2" },
      }));

      alert("Menu item added successfully.");
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("Something went wrong while adding the menu item.");
    }
  };
  /*
   * ============================================================
   * CSV EXPORT
   * ============================================================
   */

  function exportCSV() {
    const rows = [
      [
        "Order #",
        "Table",
        "Waiter",
        "Items",
        "Total",
        "Payment Method",
        "Status",
        "Created At",
        "Paid At",
      ],

      ...orders.map((order) => {
        const payment = order.payments?.[order.payments.length - 1];

        const items =
          order.order_items
            ?.map((item) => `${item.quantity}x ${item.item_name}`)
            .join("; ") || "";

        return [
          orderNumber(order.order_number),
          order.table?.table_number || order.table_id,
          order.waiter?.name || order.waiter_id,
          items,
          order.total.toFixed(2),
          payment?.method || "",
          order.status,
          new Date(order.created_at).toLocaleString(),
          order.paid_at ? new Date(order.paid_at).toLocaleString() : "",
        ];
      }),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "chow-n-vibes-sales-ledger.csv";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /*
   * ============================================================
   * ACCOUNTING CALCULATIONS
   * ============================================================
   */

  const paidOrders = orders.filter(isPaid);

  const totalSales = paidOrders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0,
  );

  const awaitingPayment = orders.filter(
    (order) => !isPaid(order),
  ).length;

  const byMethod = PAY_METHODS.map((method) => ({
    ...method,

    total: paidOrders
      .filter((order) =>
        order.payments?.some((payment) => payment.method === method.id),
      )
      .reduce((sum, order) => sum + Number(order.total || 0), 0),
  }));

  function isFlagged(order: Order) {
    return (
      !isPaid(order) &&
      minutesBetween(order.created_at, now) >= FLAG_MINUTES
    );
  }

  const flaggedOrders = orders.filter(isFlagged);

  /*
   * ============================================================
   * STYLES
   * ============================================================
   */

  const shellStyle = {
    background: "var(--ink)",
    minHeight: "100dvh",
    color: "var(--cream)",
    fontFamily: "var(--sans)",
  };

  const monoStyle = {
    fontFamily: "var(--mono)",
  };

  const inputStyle = {
    background: "var(--ink-deep)",
    border: "1px solid var(--line)",
    color: "var(--cream)",
    ...monoStyle,
  };

  const fonts = (
    <style>{`
      * {
        box-sizing: border-box;
      }

      html,
      body,
      #root {
        min-height: 100%;
        margin: 0;
      }

      body { background: var(--ink); }

      button {
        cursor: pointer;
      }

      input,
      textarea {
        outline: none;
      }

      button:disabled {
        cursor: not-allowed;
      }
    `}</style>
  );

  /*
   * ============================================================
   * NAVIGATION
   * ============================================================
   */

  function NavBar() {
    return (
      <div
        role="alert"
        aria-live="polite"
        style={{
          borderBottom: "1px solid #3A3634",
        }}
        className="flex items-center justify-between px-5 py-3"
      >
        <span className="flex items-center gap-2" style={monoStyle}>
          <Receipt size={18} color="#C68A3F" />

          <span className="text-sm text-[#C68A3F]">CHOW 'N' VIBES</span>

          <span
            style={{
              color: "#6B655C",
            }}
            className="text-[10px] uppercase"
          >
            · {profile?.name}
          </span>
        </span>

        <div className="flex gap-1 items-center">
          {role === "waiter" && (
            <>
              <button
                onClick={() => setView("landing")}
                style={{
                  ...monoStyle,
                  background: [
                    "landing",
                    "table-select",
                    "menu",
                    "confirmed",
                  ].includes(view)
                    ? "#C68A3F"
                    : "transparent",

                  color: [
                    "landing",
                    "table-select",
                    "menu",
                    "confirmed",
                  ].includes(view)
                    ? "#211F1E"
                    : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
              >
                Order
              </button>

              <button
                onClick={() => setView("staff")}
                style={{
                  ...monoStyle,
                  background: view === "staff" ? "#C68A3F" : "transparent",

                  color: view === "staff" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
              >
                Queue
              </button>
            </>
          )}

          {role === "accountant" && (
            <>
              <button
                onClick={() => setView("ledger")}
                style={{
                  ...monoStyle,
                  background: view === "ledger" ? "#C68A3F" : "transparent",

                  color: view === "ledger" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
              >
                Ledger
              </button>

              <button
                onClick={() => setView("menu-manage")}
                style={{
                  ...monoStyle,
                  background:
                    view === "menu-manage" ? "#C68A3F" : "transparent",

                  color: view === "menu-manage" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
              >
                Menu
              </button>

              <button
                onClick={() => setView("vip-menu")}
                style={{
                  ...monoStyle,
                  background: view === "vip-menu" ? "#C68A3F" : "transparent",

                  color: view === "vip-menu" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="text-xs px-3 py-1.5 rounded-sm"
              >
                VIP Menu
              </button>

              <button
                onClick={() => setView("inventory")}
                style={{
                  ...monoStyle,
                  background:
                    view === "inventory" ? "#C68A3F" : "transparent",

                  color: view === "inventory" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="relative text-xs px-3 py-1.5 rounded-sm"
              >
                Inventory
                {lowStockItems.length > 0 && (
                  <span
                    style={{
                      background: "#B8763F",
                      color: "#211F1E",
                      minWidth: 16,
                      height: 16,
                    }}
                    className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full text-[9px] font-semibold px-1"
                  >
                    {lowStockItems.length}
                  </span>
                )}
              </button>
            </>
          )}

          <button
            onClick={() =>
              pushEnabled ? disablePushNotifications() : enablePushNotifications()
            }
            style={{
              color: pushEnabled ? "#C68A3F" : "#8A8478",
            }}
            className="p-1.5 rounded-sm hover:text-[#C68A3F]"
            title={pushEnabled ? "Notifications on" : "Enable notifications"}
          >
            {pushEnabled ? <Bell size={15} /> : <BellOff size={15} />}
          </button>

          <button
            onClick={signOut}
            style={{
              color: "#8A8478",
            }}
            className="ml-2 p-1.5 rounded-sm hover:text-[#C97C7C]"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ERROR
   * ============================================================
   */

  function ErrorBox() {
    if (!error) return null;

    return (
      <div
        style={{
          background: "#3A2020",
          border: "1px solid #8B3A3A",
          color: "#F0BABA",
        }}
        className="mx-5 mt-4 p-3 rounded-sm text-xs flex gap-2 items-start"
      >
        <AlertTriangle size={15} className="shrink-0 mt-0.5" />

        <div className="flex-1">{error}</div>

        <button
          onClick={() => setError("")}
          style={{
            color: "#F0BABA",
          }}
          aria-label="Dismiss message"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6"
      >
        {fonts}

        <div
          className="w-full max-w-xs space-y-3"
          aria-label="Loading staff console"
        >
          <div className="skeleton-line w-20" />
          <div className="skeleton-line w-40" />
          <div className="mt-7 space-y-2">
            <div className="skeleton-line w-full" />
            <div className="skeleton-line w-4/5" />
            <div className="skeleton-line w-3/5" />
          </div>
        </div>
        <span style={{ ...monoStyle, color: "#8A8478" }} className="text-xs">
          preparing the service floor...
        </span>
      </div>
    );
  }

  /*
   * ============================================================
   * AUTH SCREEN
   * ============================================================
   */

  if (!session) {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16 text-center"
      >
        {fonts}

        <div className="flex items-center gap-2 mb-8">
          <Receipt size={19} color="#C68A3F" />

          <span
            style={{
              ...monoStyle,
              color: "#C68A3F",
            }}
            className="text-sm"
          >
            CHOW 'N' VIBES
          </span>
        </div>

        <p
          style={{
            color: "#8A8478",
          }}
          className="text-sm mb-6"
        >
          {authMode === "signin"
            ? "Sign in to your account"
            : "Create a new account"}
        </p>

        <form
          onSubmit={authMode === "signin" ? signIn : signUp}
          className="flex flex-col gap-3 w-full max-w-xs"
        >
          {authMode === "signup" && (
            <input
              value={authName}
              onChange={(e) => setAuthName(e.target.value)}
              placeholder="Full name"
              style={inputStyle}
              className="px-3 py-2.5 rounded-sm text-sm"
            />
          )}

          <input
            type="email"
            autoComplete="email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            placeholder="Email address"
            style={inputStyle}
            className="px-3 py-2.5 rounded-sm text-sm"
          />

          <input
            type="password"
            autoComplete={
              authMode === "signin" ? "current-password" : "new-password"
            }
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            placeholder="Password"
            style={inputStyle}
            className="px-3 py-2.5 rounded-sm text-sm"
          />

          {authMode === "signup" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthRole("waiter")}
                style={{
                  ...monoStyle,
                  background: authRole === "waiter" ? "#C68A3F" : "transparent",

                  color: authRole === "waiter" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="flex-1 py-2.5 rounded-sm text-xs flex items-center justify-center gap-1.5"
              >
                <ClipboardList size={13} />
                Waiter
              </button>

              <button
                type="button"
                onClick={() => setAuthRole("accountant")}
                style={{
                  ...monoStyle,
                  background:
                    authRole === "accountant" ? "#C68A3F" : "transparent",

                  color: authRole === "accountant" ? "#211F1E" : "#B8B2A8",

                  border: "1px solid #3A3634",
                }}
                className="flex-1 py-2.5 rounded-sm text-xs flex items-center justify-center gap-1.5"
              >
                <Calculator size={13} />
                Accountant
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            style={{
              background: authLoading ? "#66502F" : "#C68A3F",

              color: "#211F1E",
              ...monoStyle,
            }}
            className="py-3 rounded-sm text-sm font-medium flex items-center justify-center gap-2"
          >
            {authLoading && <Loader2 size={15} className="animate-spin" />}

            {authMode === "signin" ? (
              <>
                <Lock size={15} />
                Sign in
              </>
            ) : (
              <>
                <UserPlus size={15} />
                Create account
              </>
            )}
          </button>
        </form>

        <button
          onClick={() => {
            setAuthMode(authMode === "signin" ? "signup" : "signin");
            setError("");
          }}
          style={{
            ...monoStyle,
            color: "#8A8478",
          }}
          className="text-xs mt-5"
        >
          {authMode === "signin"
            ? "Don't have an account? Sign up"
            : "Already have an account? Sign in"}
        </button>

        <ErrorBox />
      </div>
    );
  }

  /*
   * ============================================================
   * PROFILE FALLBACK
   * ============================================================
   *
   * THIS IS THE IMPORTANT BLANK-SCREEN FIX.
   *
   * If authentication succeeds but the profiles row is missing,
   * the old application reached `return null`.
   *
   * Now the user gets a visible explanation instead.
   */

  if (!profile || !role) {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center"
      >
        {fonts}

        <AlertTriangle size={40} color="#C68A3F" className="mb-4" />

        <h2 className="text-xl font-semibold mb-2">Account setup incomplete</h2>

        <p
          style={{
            color: "#8A8478",
          }}
          className="text-sm max-w-md mb-4"
        >
          You successfully signed in, but your staff profile could not be
          loaded.
        </p>

        {error && (
          <div
            style={{
              background: "#3A2020",
              border: "1px solid #8B3A3A",
              color: "#F0BABA",
            }}
            className="max-w-md w-full p-3 rounded-sm text-xs mb-5"
          >
            {error}
          </div>
        )}

        <p
          style={{
            color: "#6B655C",
          }}
          className="text-[11px] max-w-sm mb-5"
        >
          Check Supabase → Table Editor → profiles and make sure the profile ID
          matches this Auth user's UUID and the role is either waiter or
          accountant.
        </p>

        <button
          onClick={signOut}
          style={{
            background: "#C68A3F",
            color: "#211F1E",
            ...monoStyle,
          }}
          className="px-5 py-3 rounded-sm text-sm font-semibold"
        >
          Sign Out
        </button>
      </div>
    );
  }

  /*
   * ============================================================
   * WAITER LANDING + QR
   * ============================================================
   */

  if (role === "waiter" && view === "landing") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="flex flex-col items-center justify-center px-6 text-center min-h-[calc(100dvh-64px)]">
          <p
            style={{
              ...monoStyle,
              color: "#C68A3F",
            }}
            className="text-xs mb-1"
          >
            CHOW 'N' VIBES
          </p>

          <button
            onClick={resetOrdering}
            style={{
              background: "#C68A3F",
              color: "#211F1E",
              ...monoStyle,
            }}
            className="py-3 rounded-sm font-medium text-sm w-full max-w-xs flex items-center justify-center gap-2"
          >
            <QrCode size={16} />
            Start an order
          </button>

          <p
            style={{
              color: "#6B655C",
            }}
            className="text-xs mt-6 max-w-xs"
          >
            Select the table you're serving, take the order and submit it to the
            queue.
          </p>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * TABLE SELECTION
   * ============================================================
   */

  if (role === "waiter" && view === "table-select") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-6 py-8">
          <button
            onClick={() => setView("landing")}
            className="flex items-center gap-1 text-xs mb-7"
            style={{
              color: "#8A8478",
              ...monoStyle,
            }}
          >
            <ArrowLeft size={14} />
            back
          </button>

          <div className="text-center mb-5">
            <p
              style={{
                ...monoStyle,
                color: "#C68A3F",
              }}
              className="text-xs"
            >
              TABLE SELECTION
            </p>

            <p
              style={{
                color: "#8A8478",
              }}
              className="text-sm mt-1"
            >
              Which table are you serving?
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 w-full max-w-xs mx-auto">
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => {
                  setSelectedTable(table);
                  setCart({});
                  setView("menu");
                }}
                style={{
                  border: "1px solid #3A3634",
                  ...monoStyle,
                }}
                className="aspect-square rounded-sm text-lg font-semibold flex items-center justify-center"
              >
                {table.table_number}
              </button>
            ))}
          </div>

          {tables.length === 0 && (
            <p
              style={{
                color: "#6B655C",
              }}
              className="text-xs text-center mt-6"
            >
              No active tables were found.
            </p>
          )}
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * MENU / TAKE ORDER
   * ============================================================
   */

  if (role === "waiter" && view === "menu") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 pt-4 pb-40">
          <div className="flex items-center justify-between mb-5">
            <button
            onClick={resetOrdering}
              className="flex items-center gap-1 text-xs"
              style={{
                color: "#8A8478",
                ...monoStyle,
              }}
            >
              <ArrowLeft size={14} />
              table {selectedTable?.table_number}
            </button>

          <button
            onClick={resetOrdering}
            style={{
              color: "#C97C7C",
              ...monoStyle,
            }}
            className="text-[10px] uppercase"
          >
            reset
          </button>

            <span
              style={{
                ...monoStyle,
                color: "#C68A3F",
              }}
              className="text-xs"
            >
              {cartItems.reduce((sum, item) => sum + item.quantity, 0)} item(s)
            </span>
          </div>

          {groupedMenu.map((category) => {
            const SectionIcon =
              ICON_MAP[category.icon || "food"] || UtensilsCrossed;

            return (
              <div key={category.id} className="mb-7">
                <div className="flex items-center gap-2 mb-2">
                  <SectionIcon size={15} color="#C68A3F" />

                  <h3 className="text-sm font-semibold tracking-wide">
                    {category.name}
                  </h3>
                </div>

                <div className="flex flex-col gap-1">
                  {category.items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        borderBottom: "1px dashed #3A3634",
                      }}
                      className="flex items-center justify-between py-3"
                    >
                      <div className="pr-3">
                        <p className="text-sm">{item.name}</p>

                        {item.description && (
                          <p
                            style={{
                              color: "#6B655C",
                            }}
                            className="text-[10px] mt-0.5"
                          >
                            {item.description}
                          </p>
                        )}

                        <p
                          style={{
                            ...monoStyle,
                            color: "#8A8478",
                          }}
                          className="text-xs mt-1"
                        >
                          {money(item.price)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(cart[item.id] || 0) > 0 && (
                          <>
                            <button
                              onClick={() => addToCart(item.id, -1)}
                              style={{
                                border: "1px solid #3A3634",
                              }}
                              className="w-7 h-7 rounded-full flex items-center justify-center"
                            >
                              <Minus size={12} />
                            </button>

                            <span
                              style={monoStyle}
                              className="w-4 text-center text-sm"
                            >
                              {cart[item.id]}
                            </span>
                          </>
                        )}

                        <button
                          onClick={() => addToCart(item.id, 1)}
                          style={{
                            background: "#C68A3F",
                            color: "#211F1E",
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {cartItems.length > 0 && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              background: "#1A1817",
              borderTop: "1px solid #3A3634",
            }}
            className="px-5 py-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                style={{
                  ...monoStyle,
                  color: "#8A8478",
                }}
                className="text-xs"
              >
                Total
              </span>

              <span style={monoStyle} className="text-base font-medium">
                {money(cartTotal)}
              </span>
            </div>

            <button
              disabled={submitting}
              onClick={submitOrder}
              style={{
                background: submitting ? "#66502F" : "#C68A3F",
                color: "#211F1E",
                ...monoStyle,
              }}
              className="w-full py-3 rounded-sm text-sm font-medium flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}

              {submitting
                ? "Saving order..."
                : `Submit order · Table ${selectedTable?.table_number}`}
            </button>
          </div>
        )}
      </div>
    );
  }

  /*
   * ============================================================
   * CONFIRMED
   * ============================================================
   */

  if (role === "waiter" && view === "confirmed") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <div className="px-6 py-16 flex flex-col items-center text-center">
          <div
            style={{
              background: "#3F6B4F",
            }}
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          >
            <Check size={26} color="#F5EFE4" />
          </div>

          <p
            style={{
              ...monoStyle,
              color: "#C68A3F",
            }}
            className="text-xs mb-1"
          >
            ORDER #{orderNumber(confirmedOrder?.order_number)}
          </p>

          <h2 className="text-xl font-semibold mb-1">Order sent</h2>

          <p
            style={{
              color: "#8A8478",
            }}
            className="text-sm mb-8"
          >
            Table {confirmedOrder?.table?.table_number} · The order is now in
            the queue.
          </p>

          <div className="flex gap-3">
            <button
              onClick={resetOrdering}
              style={{
                border: "1px solid #3A3634",
                ...monoStyle,
              }}
              className="px-5 py-2 rounded-sm text-sm"
            >
              New order
            </button>

            <button
              onClick={() => setView("staff")}
              style={{
                background: "#C68A3F",
                color: "#211F1E",
                ...monoStyle,
              }}
              className="px-5 py-2 rounded-sm text-sm"
            >
              Queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * WAITER QUEUE
   * ============================================================
   */

  if (role === "waiter" && view === "staff") {
    const filteredOrders = orders.filter((order) => {
      if (staffFilter === "open") {
        return !isPaid(order);
      }

      if (staffFilter === "paid") {
        return isPaid(order);
      }

      if (staffFilter === "vip") {
        return order.order_source === "vip";
      }

      return true;
    });

    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} color="#C68A3F" />

              <h2 className="text-sm font-semibold">Order Queue</h2>
            </div>

            <div className="flex gap-1">
              {(["open", "paid", "vip", "all"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStaffFilter(filter)}
                  style={{
                    ...monoStyle,
                    background:
                      staffFilter === filter ? "#C68A3F" : "transparent",

                    color: staffFilter === filter ? "#211F1E" : "#8A8478",

                    border: "1px solid #3A3634",
                  }}
                  className="text-[10px] px-2 py-1 rounded-sm capitalize"
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 && (
            <p
              style={{
                color: "#6B655C",
              }}
              className="text-sm text-center py-12"
            >
              No orders in this view.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {filteredOrders.map((order) => {
              const payment = order.payments?.[order.payments.length - 1];

              return (
                <div
                  key={order.id}
                  style={{
                    border: isFlagged(order)
                      ? "1px solid #8B3A3A"
                      : "1px solid #3A3634",

                    background: "#1A1817",
                  }}
                  className="p-4 rounded-sm"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      style={{
                        ...monoStyle,
                        color: "#C68A3F",
                      }}
                      className="text-xs"
                    >
                      #{orderNumber(order.order_number)} · table{" "}
                      {order.table?.table_number}
                    </span>

                    <span
                      style={{
                        ...monoStyle,
                        color: isPaid(order) ? "#3F6B4F" : "#B8763F",
                      }}
                      className="text-[10px] uppercase"
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span
                      style={{
                        color: "#8A8478",
                      }}
                      className="text-[11px]"
                    >
                      {order.waiter?.name} ·{" "}
                      {minutesBetween(order.created_at, now)} min ago
                    </span>

                    {isFlagged(order) && (
                      <span
                        style={{
                          color: "#C97C7C",
                          ...monoStyle,
                        }}
                        className="text-[10px] flex items-center gap-1"
                      >
                        <AlertTriangle size={11} />
                        review
                      </span>
                    )}
                  </div>

                  <div className="mb-3">
                    {(order.order_items || []).map((item) => (
                      <div
                        key={item.id || newLocalId()}
                        className="flex justify-between text-sm"
                        style={{
                          color: "#D8D3C8",
                        }}
                      >
                        <span>
                          {item.quantity}× {item.item_name}
                        </span>

                        <span style={monoStyle}>{money(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div
                    style={{
                      borderTop: "1px dashed #3A3634",
                    }}
                    className="pt-2 flex items-center justify-between mb-3"
                  >
                    <span
                      className="text-xs"
                      style={{
                        color: "#8A8478",
                      }}
                    >
                      Total
                    </span>

                    <span style={monoStyle} className="text-sm font-medium">
                      {money(order.total)}
                    </span>
                  </div>

                  {!isPaid(order) && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        {PAY_METHODS.map((method) => (
                          <button
                            key={method.id}
                            onClick={() => markPaid(order, method.id)}
                            style={{
                              border: "1px solid #3A3634",
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-sm text-[10px]"
                          >
                            <method.icon size={12} />
                            {method.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {payment && (
                    <p
                      style={{
                        color: "#6B655C",
                        ...monoStyle,
                      }}
                      className="text-[9px] mt-2"
                    >
                      Paid by {payment.method}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * INVENTORY
   * ============================================================
   */

  if (role === "accountant" && view === "inventory") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ClipboardList size={16} color="#C68A3F" />

              <h2 className="text-sm font-semibold">Inventory</h2>
            </div>

            <button
              onClick={loadInventory}
              style={{
                color: "#8A8478",
              }}
              className="p-1"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <p
            style={{
              color: "#6B655C",
            }}
            className="text-[11px] mb-4"
          >
            Stock reduces automatically once an order for a linked menu item
            is marked paid. Use "Add Stock" when new supply comes in.
          </p>

          {unsyncedMenuItemsCount > 0 && (
            <button
              onClick={syncInventoryFromMenu}
              disabled={syncingInventory}
              style={{
                background: "#C68A3F",
                color: "#211F1E",
              }}
              className="w-full text-xs py-2.5 rounded-sm mb-4"
            >
              {syncingInventory
                ? "Syncing..."
                : `Add ${unsyncedMenuItemsCount} Menu Item${
                    unsyncedMenuItemsCount === 1 ? "" : "s"
                  } to Inventory`}
            </button>
          )}

          {lowStockItems.length > 0 && (
            <div
              style={{
                border: "1px solid #B8763F",
                background: "rgba(184,118,63,0.12)",
              }}
              className="p-3 rounded-sm mb-5 flex items-start gap-2"
            >
              <AlertTriangle size={16} color="#B8763F" className="mt-0.5 shrink-0" />

              <div>
                <p
                  style={{
                    color: "#B8763F",
                  }}
                  className="text-xs font-semibold mb-1"
                >
                  {lowStockItems.length} item
                  {lowStockItems.length === 1 ? "" : "s"} at or below the low
                  stock level
                </p>

                <p style={{ color: "#B8B2A8" }} className="text-[11px]">
                  {lowStockItems.map((item) => item.item_name).join(", ")}
                </p>
              </div>
            </div>
          )}

          {showNewInventoryForm ? (
            <div
              style={{
                border: "1px solid #3A3634",
                background: "#1A1817",
              }}
              className="p-3 rounded-sm mb-5"
            >
              <NewInventoryItemRow
                menuItems={menuItems}
                onCancel={() => setShowNewInventoryForm(false)}
                onCreate={async (...args) => {
                  await createInventoryItem(...args);
                  setShowNewInventoryForm(false);
                }}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowNewInventoryForm(true)}
              style={{
                border: "1px dashed #3A3634",
                color: "#B8B2A8",
              }}
              className="w-full text-xs py-2 rounded-sm mb-5"
            >
              + New Inventory Item
            </button>
          )}

          <div className="flex flex-col gap-2">
            {inventoryItems.length === 0 && (
              <p style={{ color: "#6B655C" }} className="text-xs">
                No inventory items yet. Add one above.
              </p>
            )}

            {inventoryItems.map((item) => {
              const stock = currentStock(item);
              const isLow = stock <= item.low_stock_level;
              const isEditing = editingStockItem === item.id;
              const linkedMenuItem = menuItems.find(
                (menuItem) => menuItem.id === item.menu_item_id,
              );

              return (
                <div
                  key={item.id}
                  style={{
                    border: isLow ? "1px solid #B8763F" : "1px solid #3A3634",
                    background: "#1A1817",
                  }}
                  className="p-3 rounded-sm"
                >
                  {isEditing ? (
                    <StockEditRow
                      item={item}
                      menuItems={menuItems}
                      onCancel={() => setEditingStockItem(null)}
                      onSave={updateInventoryItem}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{item.item_name}</p>

                        <p style={{ color: "#6B655C" }} className="text-[10px]">
                          {linkedMenuItem
                            ? `Linked to ${linkedMenuItem.name}`
                            : "Not linked to a menu item"}
                        </p>
                      </div>

                      <span
                        style={{
                          ...monoStyle,
                          color: isLow ? "#B8763F" : "#B8B2A8",
                        }}
                        className="text-xs"
                      >
                        {stock} {item.unit}
                      </span>

                      <button
                        onClick={() => {
                          const amount = window.prompt(
                            `Add stock to "${item.item_name}". Current: ${stock} ${item.unit}`,
                            "1",
                          );

                          const parsed = Number(amount);

                          if (amount && !Number.isNaN(parsed) && parsed > 0) {
                            addStock(item, parsed);
                          }
                        }}
                        style={{
                          color: "#B8B2A8",
                          border: "1px solid #3A3634",
                        }}
                        className="text-[10px] px-2 py-1 rounded-sm"
                      >
                        Add Stock
                      </button>

                      <button
                        onClick={() => setEditingStockItem(item.id)}
                        style={{
                          color: "#B8B2A8",
                        }}
                        className="p-1"
                      >
                        <Pencil size={14} />
                      </button>

                      <button
                        onClick={() => deleteInventoryItem(item)}
                        style={{
                          color: "#8A8478",
                        }}
                        className="p-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ACCOUNTANT MENU MANAGEMENT
   * ============================================================
   */

  if (role === "accountant" && view === "menu-manage") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Pencil size={16} color="#C68A3F" />

              <h2 className="text-sm font-semibold">Manage Menu</h2>
            </div>

            <button
              onClick={loadMenu}
              style={{
                color: "#8A8478",
              }}
              className="p-1"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <p
            style={{
              color: "#6B655C",
            }}
            className="text-[11px] mb-5"
          >
            Changes are saved directly to the database. Waiters will see the
            updated menu.
          </p>

          {groupedMenu.map((category) => (
            <div key={category.id} className="mb-7">
              <h3
                className="text-sm font-semibold mb-2"
                style={{
                  color: "#C68A3F",
                }}
              >
                {category.name}
              </h3>

              <div className="flex flex-col gap-2 mb-3">
                {category.items.map((item) => {
                  const isEditing = editingItem === item.id;

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: "1px solid #3A3634",
                        background: "#1A1817",
                      }}
                      className="p-3 rounded-sm"
                    >
                      {isEditing ? (
                        <EditMenuItem
                          item={item}
                          onCancel={() => setEditingItem(null)}
                          onSave={updateMenuItem}
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{item.name}</p>

                            {item.description && (
                              <p
                                style={{
                                  color: "#6B655C",
                                }}
                                className="text-[10px] truncate"
                              >
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col items-end">
                            <span
                              style={{
                                ...monoStyle,
                                color: "#C68A3F",
                              }}
                              className="text-xs"
                            >
                              {money(item.price)}
                            </span>

                            <span
                              style={{
                                ...monoStyle,
                                color: "#6B655C",
                              }}
                              className="text-[9px]"
                            >
                              VIP {item.vip_multiplier}x ({money(item.price * item.vip_multiplier)})
                            </span>
                          </div>

                          <button
                            onClick={() => setEditingItem(item.id)}
                            style={{
                              color: "#B8B2A8",
                            }}
                            className="p-1"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            onClick={() => removeMenuItem(item)}
                            style={{
                              color: "#B8763F",
                            }}
                            className="p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  placeholder="New item name"
                  value={newItemDraft[category.id]?.name || ""}
                  onChange={(e) =>
                    setNewItemDraft((current) => ({
                      ...current,
                      [category.id]: {
                        ...(current[category.id] || {}),
                        name: e.target.value,
                      },
                    }))
                  }
                  style={inputStyle}
                  className="text-xs px-2 py-2 rounded-sm"
                />

                <div className="flex gap-2">
                  <input
                    placeholder="Description"
                    value={newItemDraft[category.id]?.description || ""}
                    onChange={(e) =>
                      setNewItemDraft((current) => ({
                        ...current,
                        [category.id]: {
                          ...(current[category.id] || {}),
                          description: e.target.value,
                        },
                      }))
                    }
                    style={inputStyle}
                    className="flex-1 text-xs px-2 py-2 rounded-sm"
                  />

                  <input
                    placeholder="Price"
                    type="number"
                    value={newItemDraft[category.id]?.price || ""}
                    onChange={(e) =>
                      setNewItemDraft((current) => ({
                        ...current,
                        [category.id]: {
                          ...(current[category.id] || {}),
                          price: e.target.value,
                        },
                      }))
                    }
                    style={inputStyle}
                    className="w-24 text-xs px-2 py-2 rounded-sm"
                  />

                  <input
                    placeholder="VIP x"
                    type="number"
                    step="0.05"
                    title="VIP price multiplier (e.g. 1.25, 1.5, 2)"
                    value={
                      newItemDraft[category.id]?.vipMultiplier ?? "2"
                    }
                    onChange={(e) =>
                      setNewItemDraft((current) => ({
                        ...current,
                        [category.id]: {
                          ...(current[category.id] || {}),
                          vipMultiplier: e.target.value,
                        },
                      }))
                    }
                    style={inputStyle}
                    className="w-16 text-xs px-2 py-2 rounded-sm"
                  />

                  <button
                    onClick={() => addMenuItem(category.id)}
                    style={{
                      background: "#C68A3F",
                      color: "#211F1E",
                    }}
                    className="px-3 rounded-sm"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ACCOUNTANT VIP MENU
   * ============================================================
   */

  if (role === "accountant" && view === "vip-menu") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 py-4 pb-16">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold">VIP Menu</h2>
          </div>

          <p
            style={{
              color: "#6B655C",
            }}
            className="text-[11px] mb-5"
          >
            Set what VIP customers pay for each item directly. Regular menu
            prices are shown for reference and aren't changed here.
          </p>

          {groupedMenu.map((category) => (
            <div key={category.id} className="mb-7">
              <h3
                className="text-sm font-semibold mb-2"
                style={{
                  color: "#C68A3F",
                }}
              >
                {category.name}
              </h3>

              <div className="flex flex-col gap-2">
                {category.items.map((item) => (
                  <VipPriceRow key={item.id} item={item} onSave={updateVipPrice} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * ACCOUNTANT LEDGER
   * ============================================================
   */

  if (role === "accountant" && view === "ledger") {
    return (
      <div
        style={shellStyle}
        className="staff-shell w-full min-h-[100dvh] overflow-hidden"
      >
        {fonts}

        <NavBar />

        <ErrorBox />

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen size={16} color="#C68A3F" />

              <h2 className="text-sm font-semibold">Sales Ledger</h2>
            </div>

            <div className="flex gap-1">
              <button
                onClick={loadOrders}
                style={{
                  border: "1px solid #3A3634",
                }}
                className="p-2 rounded-sm"
              >
                <RefreshCw size={13} />
              </button>

              <button
                onClick={exportCSV}
                style={{
                  border: "1px solid #3A3634",
                  ...monoStyle,
                }}
                className="flex items-center gap-1 text-[10px] px-3 py-1.5 rounded-sm text-[#B8B2A8]"
              >
                <Download size={12} />
                CSV
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Paid orders" value={String(paidOrders.length)} />

            <StatCard
              label="Awaiting payment"
              value={String(awaitingPayment)}
            />

            <StatCard label="Total sales" value={money(totalSales)} accent />

            <StatCard
              label="Flagged"
              value={String(flaggedOrders.length)}
              danger={flaggedOrders.length > 0}
            />
          </div>

          <p
            style={{
              color: "#6B655C",
            }}
            className="text-[10px] mb-5"
          >
            Flagged orders are unpaid orders open for at least {FLAG_MINUTES}{" "}
            minutes.
          </p>

          <div className="mb-6">
            <p
              style={{
                color: "#8A8478",
              }}
              className="text-[11px] mb-2"
            >
              By payment method
            </p>

            <div className="flex flex-col gap-2">
              {byMethod.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span
                    className="flex items-center gap-1.5"
                    style={{
                      color: "#D8D3C8",
                    }}
                  >
                    <method.icon size={13} color="#8A8478" />

                    {method.label}
                  </span>

                  <span style={monoStyle}>{money(method.total)}</span>
                </div>
              ))}
            </div>
          </div>

          <p
            style={{
              color: "#8A8478",
            }}
            className="text-[11px] mb-2"
          >
            All records
          </p>

          <div className="flex flex-col gap-2">
            {orders.length === 0 && (
              <p
                style={{
                  color: "#6B655C",
                }}
                className="text-sm text-center py-8"
              >
                No records yet.
              </p>
            )}

            {orders.map((order) => {
              const payment = order.payments?.[order.payments.length - 1];

              return (
                <div
                  key={order.id}
                  style={{
                    borderBottom: "1px dashed #3A3634",

                    borderLeft: isFlagged(order) ? "2px solid #8B3A3A" : "none",

                    paddingLeft: isFlagged(order) ? "8px" : "0",
                  }}
                  className="py-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p style={monoStyle} className="text-xs">
                        #{orderNumber(order.order_number)} · table{" "}
                        {order.table?.table_number}
                      </p>

                      <p
                        style={{
                          color: "#6B655C",
                        }}
                        className="text-[10px]"
                      >
                        {order.waiter?.name} ·{" "}
                        {new Date(order.created_at).toLocaleString()}
                      </p>

                      <p
                        style={{
                          color: "#6B655C",
                        }}
                        className="text-[10px]"
                      >
                        Payment: {payment?.method || "unpaid"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p style={monoStyle} className="text-sm">
                        {money(order.total)}
                      </p>

                      <p
                        style={{
                          color:
                            isPaid(order)
                              ? "#3F6B4F"
                              : isFlagged(order)
                                ? "#C97C7C"
                                : "#B8763F",
                        }}
                        className="text-[10px] uppercase"
                      >
                        {isFlagged(order) ? "review" : order.status}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /*
   * ============================================================
   * UNEXPECTED VIEW/ROLE FALLBACK
   * ============================================================
   *
   * This replaces the old `return null`.
   * The application will NEVER silently become blank again.
   */

  return (
    <div
      style={shellStyle}
      className="staff-shell w-full min-h-[100dvh] flex flex-col items-center justify-center px-6 text-center"
    >
      {fonts}

      <AlertTriangle size={40} color="#C68A3F" className="mb-4" />

      <h2 className="text-xl font-semibold mb-2">Something needs attention</h2>

      <p
        style={{
          color: "#8A8478",
        }}
        className="text-sm max-w-md mb-4"
      >
        Your account is signed in, but the application could not determine which
        screen to display.
      </p>

      <div
        style={{
          background: "#1A1817",
          border: "1px solid #3A3634",
        }}
        className="p-4 rounded-sm text-left max-w-md w-full mb-5"
      >
        <p
          style={{
            ...monoStyle,
            color: "#8A8478",
          }}
          className="text-[10px] mb-1"
        >
          ROLE
        </p>

        <p
          style={{
            ...monoStyle,
            color: "#C68A3F",
          }}
          className="text-xs mb-3"
        >
          {role || "not set"}
        </p>

        <p
          style={{
            ...monoStyle,
            color: "#8A8478",
          }}
          className="text-[10px] mb-1"
        >
          VIEW
        </p>

        <p
          style={{
            ...monoStyle,
            color: "#F5EFE4",
          }}
          className="text-xs"
        >
          {view}
        </p>
      </div>

      {error && (
        <p
          style={{
            color: "#C97C7C",
          }}
          className="text-xs max-w-md mb-5"
        >
          {error}
        </p>
      )}

      <button
        onClick={signOut}
        style={{
          background: "#C68A3F",
          color: "#211F1E",
          ...monoStyle,
        }}
        className="px-5 py-3 rounded-sm text-sm font-semibold"
      >
        Sign Out
      </button>
    </div>
  );
}

function VipPriceRow({
  item,
  onSave,
}: {
  item: MenuItem;
  onSave: (item: MenuItem, vipPriceInput: string) => void;
}) {
  const currentVipPrice = item.price * item.vip_multiplier;
  const [value, setValue] = useState(String(currentVipPrice));
  const [dirty, setDirty] = useState(false);

  return (
    <div
      style={{
        border: "1px solid #3A3634",
        background: "#1A1817",
      }}
      className="flex items-center gap-3 p-3 rounded-sm"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{item.name}</p>

        <p
          style={{
            color: "#6B655C",
            fontFamily: "var(--mono)",
          }}
          className="text-[10px]"
        >
          Regular: {money(item.price)}
        </p>
      </div>

      <input
        type="number"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(true);
        }}
        style={{
          background: "#211F1E",
          border: "1px solid #3A3634",
          color: "#F5EFE4",
          fontFamily: "var(--mono)",
        }}
        className="w-28 text-xs px-2 py-2 rounded-sm text-right"
        placeholder="VIP price"
      />

      <button
        onClick={() => {
          onSave(item, value);
          setDirty(false);
        }}
        disabled={!dirty}
        style={{
          background: dirty ? "#C68A3F" : "#3A3634",
          color: dirty ? "#211F1E" : "#6B655C",
        }}
        className="px-3 py-2 rounded-sm"
      >
        <Check size={14} />
      </button>
    </div>
  );
}

function StockEditRow({
  item,
  menuItems,
  onCancel,
  onSave,
}: {
  item: InventoryItem;
  menuItems: MenuItem[];
  onCancel: () => void;
  onSave: (
    item: InventoryItem,
    lowStockLevel: string,
    unit: string,
    menuItemId: string | null,
  ) => void;
}) {
  const [lowStockLevel, setLowStockLevel] = useState(
    String(item.low_stock_level),
  );

  const [unit, setUnit] = useState(item.unit);

  const [menuItemId, setMenuItemId] = useState<string>(
    item.menu_item_id || "",
  );

  const fieldStyle = {
    background: "#211F1E",
    border: "1px solid #3A3634",
    color: "#F5EFE4",
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{item.item_name}</p>

      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
            Unit
          </p>

          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={fieldStyle}
            className="w-full text-xs px-2 py-2 rounded-sm"
          />
        </div>

        <div className="flex-1">
          <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
            Low stock level
          </p>

          <input
            type="number"
            value={lowStockLevel}
            onChange={(e) => setLowStockLevel(e.target.value)}
            style={{ ...fieldStyle, fontFamily: "var(--mono)" }}
            className="w-full text-xs px-2 py-2 rounded-sm"
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
          Linked menu item
        </p>

        <select
          value={menuItemId}
          onChange={(e) => setMenuItemId(e.target.value)}
          style={fieldStyle}
          className="w-full text-xs px-2 py-2 rounded-sm"
        >
          <option value="">Not linked</option>
          {menuItems.map((menuItem) => (
            <option key={menuItem.id} value={menuItem.id}>
              {menuItem.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() =>
            onSave(item, lowStockLevel, unit, menuItemId || null)
          }
          style={{
            background: "#C68A3F",
            color: "#211F1E",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Save
        </button>

        <button
          onClick={onCancel}
          style={{
            border: "1px solid #3A3634",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function NewInventoryItemRow({
  menuItems,
  onCancel,
  onCreate,
}: {
  menuItems: MenuItem[];
  onCancel: () => void;
  onCreate: (
    itemName: string,
    unit: string,
    openingStock: string,
    lowStockLevel: string,
    menuItemId: string | null,
  ) => void;
}) {
  const [itemName, setItemName] = useState("");
  const [unit, setUnit] = useState("pieces");
  const [openingStock, setOpeningStock] = useState("0");
  const [lowStockLevel, setLowStockLevel] = useState("0");
  const [menuItemId, setMenuItemId] = useState("");

  const fieldStyle = {
    background: "#211F1E",
    border: "1px solid #3A3634",
    color: "#F5EFE4",
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
          Item name
        </p>

        <input
          type="text"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="e.g. Star Beer (bottle)"
          style={fieldStyle}
          className="w-full text-xs px-2 py-2 rounded-sm"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
            Unit
          </p>

          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={fieldStyle}
            className="w-full text-xs px-2 py-2 rounded-sm"
          />
        </div>

        <div className="flex-1">
          <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
            Opening stock
          </p>

          <input
            type="number"
            value={openingStock}
            onChange={(e) => setOpeningStock(e.target.value)}
            style={{ ...fieldStyle, fontFamily: "var(--mono)" }}
            className="w-full text-xs px-2 py-2 rounded-sm"
          />
        </div>

        <div className="flex-1">
          <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
            Low stock level
          </p>

          <input
            type="number"
            value={lowStockLevel}
            onChange={(e) => setLowStockLevel(e.target.value)}
            style={{ ...fieldStyle, fontFamily: "var(--mono)" }}
            className="w-full text-xs px-2 py-2 rounded-sm"
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] mb-1" style={{ color: "#6B655C" }}>
          Linked menu item (optional)
        </p>

        <select
          value={menuItemId}
          onChange={(e) => setMenuItemId(e.target.value)}
          style={fieldStyle}
          className="w-full text-xs px-2 py-2 rounded-sm"
        >
          <option value="">Not linked</option>
          {menuItems.map((menuItem) => (
            <option key={menuItem.id} value={menuItem.id}>
              {menuItem.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() =>
            onCreate(itemName, unit, openingStock, lowStockLevel, menuItemId || null)
          }
          style={{
            background: "#C68A3F",
            color: "#211F1E",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Create
        </button>

        <button
          onClick={onCancel}
          style={{
            border: "1px solid #3A3634",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditMenuItem({
  item,
  onCancel,
  onSave,
}: {
  item: MenuItem;
  onCancel: () => void;
  onSave: (
    item: MenuItem,
    name: string,
    price: string,
    description: string,
    vipMultiplier: string,
  ) => void;
}) {
  const [name, setName] = useState(item.name);

  const [price, setPrice] = useState(String(item.price));

  const [description, setDescription] = useState(item.description || "");

  const [vipMultiplier, setVipMultiplier] = useState(String(item.vip_multiplier ?? 2));

  return (
    <div className="flex flex-col gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{
          background: "#211F1E",
          border: "1px solid #3A3634",
          color: "#F5EFE4",
        }}
        className="text-sm px-2 py-2 rounded-sm"
        placeholder="Item name"
      />

      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{
          background: "#211F1E",
          border: "1px solid #3A3634",
          color: "#F5EFE4",
        }}
        className="text-xs px-2 py-2 rounded-sm"
        placeholder="Description"
      />

      <div className="flex gap-2">
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          style={{
            background: "#211F1E",
            border: "1px solid #3A3634",
            color: "#F5EFE4",

            fontFamily: "var(--mono)",
          }}
          className="flex-1 text-xs px-2 py-2 rounded-sm"
          placeholder="Price"
        />

        <input
          type="number"
          step="0.05"
          value={vipMultiplier}
          onChange={(e) => setVipMultiplier(e.target.value)}
          style={{
            background: "#211F1E",
            border: "1px solid #3A3634",
            color: "#F5EFE4",

            fontFamily: "var(--mono)",
          }}
          className="w-20 text-xs px-2 py-2 rounded-sm"
          placeholder="VIP x"
          title="VIP price multiplier (e.g. 1.25, 1.5, 2)"
        />
      </div>

      <p
        style={{
          color: "#6B655C",
          fontFamily: "var(--mono)",
        }}
        className="text-[10px]"
      >
        VIP price preview:{" "}
        {money(Number(price || 0) * Number(vipMultiplier || 0))}
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => onSave(item, name, price, description, vipMultiplier)}
          style={{
            background: "#C68A3F",
            color: "#211F1E",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Save
        </button>

        <button
          onClick={onCancel}
          style={{
            border: "1px solid #3A3634",
          }}
          className="flex-1 py-2 rounded-sm text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
