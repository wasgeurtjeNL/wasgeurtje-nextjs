"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  variant?: string;
  originalPrice?: number;
  isHiddenProduct?: boolean; // Voor dopjes die niet zichtbaar moeten zijn
}

interface CartContextType {
  items: CartItem[];
  isOpen: boolean;
  addToCart: (item: Omit<CartItem, "quantity"> | CartItem) => void;
  removeFromCart: (id: string, variant?: string) => void;
  updateQuantity: (
    id: string,
    variant: string | undefined,
    quantity: number
  ) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  cartCount: number;
  subtotal: number;
  shippingThreshold: number;
  freeShippingAmount: number;
  remainingForFreeShipping: number;
  hasReachedFreeShipping: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const FREE_SHIPPING_THRESHOLD = 40; // €40 voor gratis verzending

// ============================================================================
// PRODUCT IDS - Dopjes en Flesjes
// ============================================================================
const CAP_2_PACK = "348218"; // plug 2 stuks
const CAP_4_PACK = "348219"; // plug 4 stuks

const BOTTLE_PRODUCTS = [
  "1427", "1425", "1423", "1417", "1410", 
  "273950", "273949", "273947", "273946", "273942"
];

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("wasgeurtje-cart");
    if (savedCart) {
      const parsed = JSON.parse(savedCart) as any[];
      setItems(
        (Array.isArray(parsed) ? parsed : []).map((i) => ({
          ...i,
          price: Number(i?.price) || 0,
          quantity: Number(i?.quantity) || 1,
        }))
      );
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("wasgeurtje-cart", JSON.stringify(items));
  }, [items]);

  // ============================================================================
  // AUTO-ADD DOPJES LOGICA - Efficiënt voor fulfillment
  // ============================================================================
  useEffect(() => {
    // Tel het totaal aantal flesjes
    let totalBottles = 0;
    items.forEach((item) => {
      if (BOTTLE_PRODUCTS.includes(item.id)) {
        totalBottles += item.quantity;
      }
    });

    // Bereken benodigde dopjes (efficiënte logica: minimale picks)
    let caps4Needed = 0;
    let caps2Needed = 0;

    if (totalBottles > 0) {
      const remaining = totalBottles % 4;
      
      if (remaining === 3) {
        // 3, 7, 11, etc. → rond op naar veelvoud van 4 (efficiënter)
        caps4Needed = Math.floor(totalBottles / 4) + 1;
        caps2Needed = 0;
      } else {
        // 0, 1, 2 → gebruik 4-packs + eventueel 1x 2-pack
        caps4Needed = Math.floor(totalBottles / 4);
        caps2Needed = remaining > 0 ? 1 : 0;
      }
    }

    // Check huidige aantallen dopjes
    const current4Pack = items.find((item) => item.id === CAP_4_PACK);
    const current2Pack = items.find((item) => item.id === CAP_2_PACK);

    const currentCaps4 = current4Pack?.quantity || 0;
    const currentCaps2 = current2Pack?.quantity || 0;

    // Update dopjes als nodig
    if (currentCaps4 !== caps4Needed || currentCaps2 !== caps2Needed) {
      setItems((currentItems) => {
        let updatedItems = [...currentItems];

        // Update of verwijder 4-pack
        if (caps4Needed > 0) {
          const index4 = updatedItems.findIndex((item) => item.id === CAP_4_PACK);
          if (index4 >= 0) {
            // Update bestaande
            updatedItems[index4] = { ...updatedItems[index4], quantity: caps4Needed };
          } else {
            // Voeg nieuw toe
            updatedItems.push({
              id: CAP_4_PACK,
              title: "plug 4 stuks",
              price: 0, // Altijd gratis
              quantity: caps4Needed,
              image: "/figma/plug.png", // Placeholder image
              isHiddenProduct: true,
            });
          }
        } else {
          // Verwijder als niet nodig
          updatedItems = updatedItems.filter((item) => item.id !== CAP_4_PACK);
        }

        // Update of verwijder 2-pack
        if (caps2Needed > 0) {
          const index2 = updatedItems.findIndex((item) => item.id === CAP_2_PACK);
          if (index2 >= 0) {
            // Update bestaande
            updatedItems[index2] = { ...updatedItems[index2], quantity: caps2Needed };
          } else {
            // Voeg nieuw toe
            updatedItems.push({
              id: CAP_2_PACK,
              title: "plug 2 stuks",
              price: 0, // Altijd gratis
              quantity: caps2Needed,
              image: "/figma/plug.png", // Placeholder image
              isHiddenProduct: true,
            });
          }
        } else {
          // Verwijder als niet nodig
          updatedItems = updatedItems.filter((item) => item.id !== CAP_2_PACK);
        }

        return updatedItems;
      });
    }
  }, [items]); // Run wanneer items veranderen

  const addToCart = (item: Omit<CartItem, "quantity"> | CartItem) => {
    // Bewaar huidige scroll positie
    const scrollPosition =
      window.pageYOffset || document.documentElement.scrollTop;

    const quantityToAdd = "quantity" in item ? item.quantity : 1;

    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (i) => i.id === item.id && i.variant === item.variant
      );

      if (existingItem) {
        return currentItems.map((i) =>
          i.id === item.id && i.variant === item.variant
            ? { ...i, quantity: i.quantity + quantityToAdd }
            : i
        );
      }

      return [...currentItems, { ...item, quantity: quantityToAdd }];
    });

    // Open cart when item is added
    setIsOpen(true);

    // Herstel de scroll positie na een korte vertraging (zodat de sidebar eerst kan openen)
    setTimeout(() => {
      window.scrollTo({
        top: scrollPosition,
        behavior: "auto", // 'auto' in plaats van 'smooth' om sprong te voorkomen
      });
    }, 50);
  };

  const removeFromCart = (id: string, variant?: string) => {
    // Voorkom verwijderen van dopjes
    if (id === CAP_2_PACK || id === CAP_4_PACK) {
      console.log("Dopjes kunnen niet handmatig verwijderd worden");
      return;
    }

    setItems((currentItems) =>
      currentItems.filter(
        (item) => !(item.id === id && item.variant === variant)
      )
    );
  };

  const updateQuantity = (
    id: string,
    variant: string | undefined,
    quantity: number
  ) => {
    // Voorkom aanpassen van dopjes
    if (id === CAP_2_PACK || id === CAP_4_PACK) {
      console.log("Dopjes worden automatisch berekend");
      return;
    }

    if (quantity < 1) {
      removeFromCart(id, variant);
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id && item.variant === variant
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const toggleCart = () => setIsOpen(!isOpen);

  // Calculate derived values (exclude hidden products like caps from count)
  const cartCount = items
    .filter((item) => !item.isHiddenProduct)
    .reduce((sum, item) => sum + item.quantity, 0);
  
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const remainingForFreeShipping = Math.max(
    0,
    FREE_SHIPPING_THRESHOLD - subtotal
  );
  const hasReachedFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        openCart,
        closeCart,
        toggleCart,
        cartCount,
        subtotal,
        shippingThreshold: FREE_SHIPPING_THRESHOLD,
        freeShippingAmount: FREE_SHIPPING_THRESHOLD,
        remainingForFreeShipping,
        hasReachedFreeShipping,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
