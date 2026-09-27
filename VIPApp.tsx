import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  Lock,
  Minus,
  Plus,
  ShoppingCart,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { supabase, supabaseConfigError } from "./supabase";

const SESSION_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

type Category = {
  id: number;
  name: string;
};

type MenuItem = {
  id: string;
  category_id: number;
  category: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  display_order: number;
};

type CartItem = MenuItem & {
  quantity: number;
};

export default function VIPApp() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    null
  );

  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");

  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [error, setError] = useState("");

  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  // --------------------------------------------------
  // LOAD TABLE FROM QR URL
  // Example: /vip?table=3
  // --------------------------------------------------

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get("table");

    if (table) {
      setTableNumber(table);
    }

    // 6-hour ordering-session lock: once someone scans a table's QR code,
    // that link stops working 6 hours later so it can't be reused later
    // (e.g. taken home and used to place fake orders).
    const sessionKey = `vip_session_start_${table || "default"}`;
    const storedStart = localStorage.getItem(sessionKey);
    const now = Date.now();

    if (storedStart) {
      if (now - Number(storedStart) >= SESSION_DURATION_MS) {
        setSessionExpired(true);
      }
    } else {
      localStorage.setItem(sessionKey, String(now));
    }

    loadMenu();

    const interval = setInterval(() => {
      const start = localStorage.getItem(sessionKey);
      if (start && Date.now() - Number(start) >= SESSION_DURATION_MS) {
        setSessionExpired(true);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // --------------------------------------------------
  // LOAD VIP MENU
  // (separate tables from the regular staff menu, so VIP
  // pricing can differ from what waiters see)
  // --------------------------------------------------

  async function loadMenu() {
    setLoading(true);
    setError("");

    if (supabaseConfigError) {
      setError(supabaseConfigError);
      setLoading(false);
      return;
    }

    try {
      const { data: menuData, error: menuError } = await supabase
        .from("menu_items")
        .select(
          "id, category, name, description, price, available"
        )
        .eq("available", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (menuError) throw menuError;

      const rawItems = menuData || [];
      const categoryNames = Array.from(
        new Set(rawItems.map((item: any) => String(item.category || "Other"))),
      );
      const categoriesData = categoryNames.map((name, index) => ({
        id: index + 1,
        name,
      }));
      const categoryIds = new Map(
        categoriesData.map((category) => [category.name, category.id]),
      );
      const normalizedItems: MenuItem[] = rawItems.map((item: any) => ({
        id: String(item.id),
        category_id: categoryIds.get(String(item.category || "Other")) || 1,
        category: String(item.category || "Other"),
        name: String(item.name || ""),
        description: item.description ?? null,
        price: Number(item.price || 0) * 2,
        active: Boolean(item.available ?? true),
        display_order: 0,
      }));

      setCategories(categoriesData);
      setMenuItems(normalizedItems);

      if (categoriesData && categoriesData.length > 0) {
        setSelectedCategory(categoriesData[0].id);
      }
    } catch (err: any) {
      console.error("MENU ERROR:", err);
      setError(err?.message || "Unable to load menu.");
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // CART
  // --------------------------------------------------

  function addToCart(item: MenuItem) {
    setCart((current) => {
      const existing = current.find((x) => x.id === item.id);

      if (existing) {
        return current.map((x) =>
          x.id === item.id
            ? { ...x, quantity: x.quantity + 1 }
            : x
        );
      }

      return [...current, { ...item, quantity: 1 }];
    });
  }

  function decreaseQuantity(id: string) {
    setCart((current) =>
      current
        .map((item) =>
          item.id === id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeItem(id: string) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  function quantityOf(id: string) {
    return cart.find((item) => item.id === id)?.quantity || 0;
  }

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      ),
    [cart]
  );

  const visibleItems = useMemo(() => {
    if (!selectedCategory) return [];

    return menuItems.filter(
      (item) => item.category_id === selectedCategory
    );
  }, [menuItems, selectedCategory]);

  // --------------------------------------------------
  // PLACE ORDER
  // --------------------------------------------------

  async function placeOrder() {
    setError("");

    if (!tableNumber.trim()) {
      setError("Please enter your table number.");
      return;
    }

    if (!cart.length) {
      setError("Your cart is empty.");
      return;
    }

    const tableId = Number(tableNumber);

    if (!Number.isInteger(tableId) || tableId <= 0) {
      setError("Please enter a valid table number.");
      return;
    }

    setPlacingOrder(true);

    try {
      // Create VIP order.
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_type: "vip",
          waiter_id: null,
          status: "pending",
          payment_status: "unpaid",
          subtotal: total,
          total: total,
          notes: `Table ${tableId}`,
        })
        .select("id")
        .single();

      if (orderError) throw orderError;

      // Create order items.
      const items = cart.map((item) => ({
        order_id: order.id,
        menu_item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        unit_price: Number(item.price),
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(items);

      if (itemsError) {
        // Prevent an order with no items.
        await supabase
          .from("orders")
          .delete()
          .eq("id", order.id);

        throw itemsError;
      }

      setOrderId(String(order.id));
      setCart([]);
      setShowCart(false);
      setOrderSuccess(true);
    } catch (err: any) {
      console.error("VIP ORDER ERROR:", err);

      setError(
        err?.message ||
          "Unable to place your order. Please try again."
      );
    } finally {
      setPlacingOrder(false);
    }
  }

  // --------------------------------------------------
  // SESSION EXPIRED
  // --------------------------------------------------

  if (sessionExpired) {
    return (
      <div className="vip-shell min-h-[100dvh] px-5 text-white">
        <div className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center">
          <div className="w-full text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/5">
              <Lock size={44} className="text-slate-400" />
            </div>

            <h1 className="mt-6 text-2xl font-bold">
              This ordering link has expired
            </h1>

            <p className="mt-3 text-slate-400">
              For your table's security, this VIP ordering session closes a
              few hours after it starts.
            </p>

            <p className="mt-5 text-sm text-slate-500">
              Please ask a member of staff for a fresh QR code to keep
              ordering.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // SUCCESS
  // --------------------------------------------------

  if (orderSuccess) {
    return (
      <div className="vip-shell min-h-[100dvh] px-5 text-white">
        <div className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center">
          <div className="w-full text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle
                size={58}
                className="text-green-400"
              />
            </div>

            <h1 className="mt-6 text-3xl font-bold">
              Order Received!
            </h1>

            <p className="mt-3 text-slate-400">
              CHOW 'N' VIBES has received your order.
            </p>

            <div className="mt-7 rounded-2xl bg-white/5 p-6">
              <p className="text-sm text-slate-400">
                Order Number
              </p>

              <p className="mt-2 text-4xl font-bold">
                #{orderId}
              </p>

              <div className="mt-5 space-y-2 text-sm">
                <p>
                  Table:{" "}
                  <span className="font-semibold">
                    {tableNumber}
                  </span>
                </p>

                <p className="text-slate-400">
                  Payment is collected by staff when you're
                  ready to close your tab.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setOrderSuccess(false);
                setOrderId("");
              }}
              className="mt-6 w-full rounded-xl bg-white py-4 font-bold text-slate-950"
            >
              Order More
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // APP
  // --------------------------------------------------

  return (
    <div className="vip-shell min-h-[100dvh] text-white">
      {/* HEADER */}

      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-black tracking-wide">
              CHOW 'N' VIBES
            </h1>

            <p className="text-xs text-slate-400">
              VIP Ordering
            </p>
          </div>

          <button
            onClick={() => setShowCart(true)}
            className="relative flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-950"
          >
            <ShoppingCart size={18} />

            Cart

            {cartCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#c97c7c] text-xs font-bold text-[#211f1e]">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <div role="alert" aria-live="polite" className="mb-5 rounded-xl border border-[#c97c7c]/30 bg-[#c97c7c]/10 p-4 text-sm text-[#efb2a8]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="w-full max-w-sm space-y-4" aria-label="Loading guest menu">
              <div className="skeleton-line w-24" />
              <div className="skeleton-line w-48" />
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="h-36 rounded-2xl bg-white/[0.06]" />
                <div className="h-36 rounded-2xl bg-white/[0.06]" />
              </div>
              <p className="text-sm text-slate-400">
                Preparing the menu...
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* TABLE */}

            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <label className="mb-2 block text-sm font-semibold">
                Table Number
              </label>

              <input
                type="number"
                min="1"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Enter your table number"
                className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>

            {/* CATEGORIES */}

            <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() =>
                    setSelectedCategory(category.id)
                  }
                  className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-semibold ${
                    selectedCategory === category.id
                      ? "bg-white text-slate-950"
                      : "bg-white/10 text-slate-300"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* MENU */}

            {visibleItems.length === 0 ? (
              <div className="py-20 text-center">
                <UtensilsCrossed
                  size={45}
                  className="mx-auto text-slate-600"
                />

                <p className="mt-4 text-slate-400">
                  No items available.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleItems.map((item) => {
                  const quantity = quantityOf(item.id);

                  return (
                    <div
                      key={item.id}
                      className="vip-card rounded-2xl border border-white/10 bg-white/5 p-5"
                    >
                      <h2 className="text-lg font-bold">
                        {item.name}
                      </h2>

                      {item.description && (
                        <p className="mt-2 text-sm text-slate-400">
                          {item.description}
                        </p>
                      )}

                      <p className="mt-4 text-lg font-black">
                        ₦
                        {Number(item.price).toLocaleString()}
                      </p>

                      {quantity === 0 ? (
                        <button
                          onClick={() => addToCart(item)}
                          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 font-bold text-slate-950"
                        >
                          <Plus size={18} />
                          Add to Order
                        </button>
                      ) : (
                        <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 p-2">
                          <button
                            onClick={() =>
                              decreaseQuantity(item.id)
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10"
                          >
                            <Minus size={18} />
                          </button>

                          <span className="font-bold">
                            {quantity}
                          </span>

                          <button
                            onClick={() => addToCart(item)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white"
                          >
                            <Plus
                              size={18}
                              className="text-slate-950"
                            />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* CART */}

      {showCart && (
        <div className="fixed inset-0 z-50 bg-black/70">
          <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-slate-950">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <button
                onClick={() => setShowCart(false)}
                className="flex items-center gap-2 text-slate-300"
              >
                <ArrowLeft size={18} />
                Back
              </button>

              <h2 className="font-bold">
                Your Order
              </h2>

              <button
                onClick={() => setShowCart(false)}
                className="text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {cart.length === 0 ? (
                <div className="py-20 text-center">
                  <ShoppingCart
                    size={45}
                    className="mx-auto text-slate-600"
                  />

                  <p className="mt-4 text-slate-400">
                    Your cart is empty.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="vip-card rounded-xl bg-white/5 p-4"
                    >
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {item.name}
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            ₦
                            {Number(
                              item.price
                            ).toLocaleString()}{" "}
                            × {item.quantity}
                          </p>
                        </div>

                        <p className="font-bold">
                          ₦
                          {(
                            Number(item.price) *
                            item.quantity
                          ).toLocaleString()}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              decreaseQuantity(item.id)
                            }
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"
                          >
                            <Minus size={15} />
                          </button>

                          <span className="w-6 text-center font-bold">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() => addToCart(item)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white"
                          >
                            <Plus
                              size={15}
                              className="text-slate-950"
                            />
                          </button>
                        </div>

                        <button
                          onClick={() =>
                            removeItem(item.id)
                          }
                          className="text-sm text-[#efb2a8]"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-white/10 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-slate-400">
                    Total
                  </span>

                  <span className="text-2xl font-black">
                    ₦{total.toLocaleString()}
                  </span>
                </div>

                <p className="mb-5 text-xs text-slate-500">
                  This is added to your table's tab. Pay
                  with staff whenever you're ready.
                </p>

                <button
                  onClick={placeOrder}
                  disabled={placingOrder}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 font-bold text-slate-950 disabled:opacity-50"
                >
                  {placingOrder ? (
                    <>
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                      Sending Order...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Place Order
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
