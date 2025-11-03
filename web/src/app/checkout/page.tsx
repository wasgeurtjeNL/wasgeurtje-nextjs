"use client";

import { useState, useEffect, Suspense, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useCart, CartItem } from "@/context/CartContext";
import { useAuth, Address } from "@/context/AuthContext";
import CheckoutLoyaltyInfo from "@/components/CheckoutLoyaltyInfo";
import CheckoutAuthPopup from "@/components/CheckoutAuthPopup";
import LoyaltyRedemptionPopup from "@/components/LoyaltyRedemptionPopup";
import { z } from "zod";
import emailSpellChecker from "@zootools/email-spell-checker";
import PaymentPage from "./payment/page";
import TestimonialsSection from "@/components/sections/TestimonialsSection";
import { useLoyality } from "@/context/LoyalityContext";
import { FeatureFlags } from "@/utils/featureFlags";
import { getSmartProductSuggestion, extractPurchasedProductIds } from "@/utils/product-suggestions";
import { trackCheckoutEmail } from "@/hooks/useCustomerTracking";
import CheckoutTracker from "@/components/analytics/CheckoutTracker";

// Email validation schema
const emailSchema = z.string().email("Voer een geldig e-mailadres in");

// List of disposable email domains (expand as needed)
const disposableEmailDomains = new Set([
  "tempmail.com",
  "throwaway.email",
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "yopmail.com",
  "trashmail.com",
  "disposablemail.com",
  "temp-mail.org",
  "tempmail.net",
  "throwawaymail.com",
  "maildrop.cc",
  "mintemail.com",
  "mailcatch.com",
  "emailondeck.com",
  "fakeinbox.com",
  "mohmal.com",
  "trbvm.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "dropmail.me",
  "inboxkitten.com",
  "getairmail.com",
  "anonymbox.com",
  "trash-mail.at",
  "temp-mail.io",
  "mailnesia.com",
  "nada.email",
]);

// Progress steps for the checkout
const CHECKOUT_STEPS = ["Gegevens", "Betaling"];

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items,
    subtotal,
    clearCart,
    addToCart,
    removeFromCart,
    updateQuantity,
  } = useCart();
  const { user, isLoggedIn, orders, fetchOrders } = useAuth();
  
  // Track if we've already fetched orders/loyalty in this checkout session
  const hasFetchedOrdersRef = useRef(false);
  
  // Track if we've already pre-filled user data to prevent overwriting user input
  const hasPrefilledUserDataRef = useRef(false);
  
  // Track which email has been tracked to prevent duplicate tracking
  const trackedEmailRef = useRef<string | null>(null);
  
  // Ref for scrolling to selected address card
  const addressScrollContainerRef = useRef<HTMLDivElement>(null);

  // State for sticky shipping header (mobile only) - can be dismissed
  const [isShippingBarDismissed, setIsShippingBarDismissed] = useState(false);
  
  // State for main header (black bar with logo) - hides on scroll
  const [showMainHeader, setShowMainHeader] = useState(true);
  
  // State for trust banner - hides on scroll down
  const [showTrustBanner, setShowTrustBanner] = useState(true);
  const lastScrollYRef = useRef(0);
  const scrollThreshold = 50; // Minimum scroll before hiding/showing
  
  // Detect if mobile menu is open to hide sticky bar
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Force text colors to be visible regardless of color scheme
  useEffect(() => {
    // Add a class to the body for checkout page specific styling
    document.body.classList.add("checkout-page");

    return () => {
      document.body.classList.remove("checkout-page");
      document.body.classList.remove("shipping-bar-hidden");
    };
  }, []);

  // Update body class when shipping bar visibility changes
  useEffect(() => {
    if (isShippingBarDismissed || isMobileMenuOpen || showMainHeader) {
      document.body.classList.add("shipping-bar-hidden");
    } else {
      document.body.classList.remove("shipping-bar-hidden");
    }
  }, [isShippingBarDismissed, isMobileMenuOpen, showMainHeader]);

  // Detect if mobile menu is open (to hide sticky bar)
  useEffect(() => {
    const checkMobileMenu = () => {
      // Check if mobile menu exists in DOM (it's rendered when open)
      const mobileMenu = document.querySelector('.bg-black.fixed.top-\\[86px\\]');
      setIsMobileMenuOpen(!!mobileMenu);
    };

    // Check immediately
    checkMobileMenu();

    // Use MutationObserver to detect when mobile menu is added/removed
    const observer = new MutationObserver(checkMobileMenu);
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Scroll detection for header and trust banner
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Only hide/show if we've scrolled past the threshold
      if (Math.abs(currentScrollY - lastScrollYRef.current) < scrollThreshold) {
        return;
      }

      if (currentScrollY > lastScrollYRef.current && currentScrollY > 100) {
        // Scrolling down - hide trust banner and main header (on mobile)
        setShowTrustBanner(false);
        setShowMainHeader(false);
        
        // Hide main header by adding class to it
        const mainHeader = document.querySelector('.bg-black.fixed');
        if (mainHeader) {
          mainHeader.classList.add('checkout-hide-header');
        }
      } else {
        // Scrolling up - show trust banner and main header
        setShowTrustBanner(true);
        setShowMainHeader(true);
        
        // Show main header by removing class
        const mainHeader = document.querySelector('.bg-black.fixed');
        if (mainHeader) {
          mainHeader.classList.remove('checkout-hide-header');
        }
      }

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      
      // Cleanup: remove class when leaving page
      const mainHeader = document.querySelector('.bg-black.fixed');
      if (mainHeader) {
        mainHeader.classList.remove('checkout-hide-header');
      }
    };
  }, []);

  // Unique addresses from past orders and user profile
  const [previousAddresses, setPreviousAddresses] = useState<
    {
      id: string;
      name: string;
      fullName: string;
      street: string;
      city: string;
      postalCode: string;
      country: string;
      isDefault?: boolean; // Track if address is set as default
    }[]
  >([]);

  // Swipe functionality state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [showProductsPopup, setShowProductsPopup] = useState(false);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    new Set()
  );

  // Netherlands-only postcode lookup state
  const [isNetherlandsSelected, setIsNetherlandsSelected] = useState(true);

  // Auth popup state
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [authPopupMessage, setAuthPopupMessage] = useState<string | undefined>(undefined);

  // Postcode lookup state
  const [isLookingUpPostcode, setIsLookingUpPostcode] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");
  const [showManualAddressInput, setShowManualAddressInput] = useState(false);
  const [addressFound, setAddressFound] = useState(false);

  // Shipping address lookup state
  const [isLookingUpShippingPostcode, setIsLookingUpShippingPostcode] =
    useState(false);
  const [shippingPostcodeError, setShippingPostcodeError] = useState("");
  const [showManualShippingAddressInput, setShowManualShippingAddressInput] =
    useState(false);
  const [shippingAddressFound, setShippingAddressFound] = useState(false);

  // Discount code state
  const [discountCode, setDiscountCode] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    amount: number;
    type: "fixed" | "percentage";
  } | null>(null);
  const [discountError, setDiscountError] = useState("");
  // Bundle discount persisted by BundleOfferPopup
  const [bundleDiscount, setBundleDiscount] = useState<number>(0);
  const [bundleDiscountMeta, setBundleDiscountMeta] = useState<{ code?: string; offerId?: number } | null>(null);

  // Address refresh state to trigger re-render after deletion
  const [addressRefresh, setAddressRefresh] = useState(0);
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);

  // Load bundle discount from localStorage
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('wg-bundle-discount') : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        const now = Date.now();
        if (!parsed.expiresAt || parsed.expiresAt > now) {
          const amount = Number(parsed.amount) || 0;
          setBundleDiscount(amount);
          setBundleDiscountMeta({ code: parsed.code, offerId: parsed.offerId });
        } else {
          localStorage.removeItem('wg-bundle-discount');
          setBundleDiscount(0);
          setBundleDiscountMeta(null);
        }
      } else {
        setBundleDiscount(0);
        setBundleDiscountMeta(null);
      }
    } catch (e) {
      console.warn('Failed to read bundle discount from storage', e);
      setBundleDiscount(0);
      setBundleDiscountMeta(null);
    }
  }, []);

  // Email validation state
  const [emailError, setEmailError] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  
  // Phone validation state
  const [phoneError, setPhoneError] = useState("");
  
  // Email recognition state
  const [emailRecognized, setEmailRecognized] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  // Address mismatch warning state
  const [showAddressMismatchWarning, setShowAddressMismatchWarning] = useState(false);
  const [knownAddressForPhone, setKnownAddressForPhone] = useState<{
    street: string;
    city: string;
    postalCode: string;
    country: string;
  } | null>(null);
  const [addressMismatchConfirmed, setAddressMismatchConfirmed] = useState(false);

  // Initialize currentStep from localStorage, default to 1 if not found
  const [currentStep, setCurrentStep] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("checkoutCurrentStep");
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize maxStepReached from localStorage, default to 1 if not found
  const [maxStepReached, setMaxStepReached] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("checkoutMaxStepReached");
      return saved ? parseInt(saved, 10) : 1;
    }
    return 1;
  });

  // State for dynamic product suggestions
  const [suggestedProducts, setSuggestedProducts] = useState<
    {
      id: string;
      title: string;
      price: number;
      image: string;
      isNew?: boolean;
      description?: string;
      badge?: string;
      inCart?: boolean;
    }[]
  >([]);

  // State for Last Chance dropdown
  const [isLastChanceSectionOpen, setIsLastChanceSectionOpen] = useState(false);

  // State for Product Suggestions dropdown
  const [isProductSuggestionsOpen, setIsProductSuggestionsOpen] = useState(false); // Default closed

  // State for Delivery Info popup
  const [showDeliveryInfoPopup, setShowDeliveryInfoPopup] = useState(false);

  // State for personalized product suggestion banner
  const [purchaseHistory, setPurchaseHistory] = useState<string[]>([]); // Array of product IDs
  const [personalizedSuggestion, setPersonalizedSuggestion] = useState<{
    productId: string;
    title: string;
    price: number;
    image: string;
    message: string;
  } | null>(null);
  const [showPersonalizedBanner, setShowPersonalizedBanner] = useState(false);
  const [bannerInteracted, setBannerInteracted] = useState(false); // Lock banner when user clicks
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // State for contact details edit mode (for logged-in users with saved data)
  const [isEditingContactDetails, setIsEditingContactDetails] = useState(false);

  // State for address management popup
  const [showAddressManagementPopup, setShowAddressManagementPopup] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  
  // State for new address form
  const [newAddress, setNewAddress] = useState({
    label: "",
    firstName: "",
    middleName: "",
    lastName: "",
    postcode: "",
    houseNumber: "",
    addition: "",
    street: "",
    city: "",
    country: "NL",
    setAsDefaultShipping: false,
    setAsDefaultBilling: false,
  });
  
  const [isLookingUpNewAddress, setIsLookingUpNewAddress] = useState(false);
  const [newAddressError, setNewAddressError] = useState("");
  const [newAddressFound, setNewAddressFound] = useState(false);
  const [showManualNewAddressInput, setShowManualNewAddressInput] = useState(false);

  // Initialize formData from localStorage
  const [formData, setFormData] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("checkoutFormData");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Error parsing saved form data:", e);
        }
      }
    }
    return {
      // Personal details
      email: "",
      firstName: "",
      lastName: "",
      phone: "",

      // Billing address
      billingAddress: "",
      billingHouseNumber: "",
      billingHouseAddition: "",
      billingPostcode: "",
      billingCity: "",
      billingCountry: "NL",

      // Shipping address
      useShippingAddress: false,
      shippingAddress: "",
      shippingHouseNumber: "",
      shippingHouseAddition: "",
      shippingPostcode: "",
      shippingCity: "",
      shippingCountry: "NL",

      // Selected address (for logged-in users with multiple addresses)
      selectedAddressId: "",

      // Additional
      companyName: "",
      vatNumber: "",
      notes: "",

      // Marketing
      newsletter: false,
      acceptTerms: true,

      // Payment
      paymentMethod: "ideal",
    };
  });

  // Handle step navigation
  const handleStepClick = (stepIndex: number) => {
    const targetStep = stepIndex + 1;

    // Only allow navigation to steps that have been reached before
    if (targetStep <= maxStepReached) {
      setCurrentStep(targetStep);

      // Scroll to top when changing steps
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Update max step reached when currentStep changes
  useEffect(() => {
    if (currentStep > maxStepReached) {
      setMaxStepReached(currentStep);
    }
  }, [currentStep, maxStepReached]);

  // Save currentStep to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("checkoutCurrentStep", currentStep.toString());
    }
  }, [currentStep]);

  // Scroll to top when changing steps (especially important for mobile/responsive)
  useEffect(() => {
    // Smooth scroll to top on any step change
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }, [currentStep]);

  // Save maxStepReached to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("checkoutMaxStepReached", maxStepReached.toString());
    }
  }, [maxStepReached]);

  // Save formData to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("checkoutFormData", JSON.stringify(formData));
    }
  }, [formData]);

  // Clear checkout data from localStorage when cart is empty or order is completed
  useEffect(() => {
    if (items.length === 0) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("checkoutCurrentStep");
        localStorage.removeItem("checkoutMaxStepReached");
        localStorage.removeItem("checkoutFormData");
      }
    }
  }, [items]);

  // Pre-fill form with user data if logged in (only once to prevent overwriting user input)
  useEffect(() => {
    if (isLoggedIn && user && !hasPrefilledUserDataRef.current) {
      // Mark as prefilled BEFORE updating to prevent race conditions
      hasPrefilledUserDataRef.current = true;
      
      // Use the first address from addresses array if available (new structure)
      const defaultAddress = user.addresses?.[0];
      
      setFormData((prev) => {
        // Only prefill fields that are still empty (to avoid overwriting localStorage or user input)
        return {
          ...prev,
          email: prev.email || user.email || "",
          firstName: prev.firstName || user.firstName || "",
          lastName: prev.lastName || user.lastName || "",
          phone: prev.phone || user.phone || "",
          // Use new addresses array structure if available (only if fields are empty)
          billingAddress: prev.billingAddress || defaultAddress?.street || "",
          billingHouseNumber: prev.billingHouseNumber || defaultAddress?.houseNumber || "",
          billingHouseAddition: prev.billingHouseAddition || defaultAddress?.houseAddition || "",
          billingCity: prev.billingCity || defaultAddress?.city || user.address?.city || "",
          billingPostcode: prev.billingPostcode || defaultAddress?.postalCode || user.address?.postalCode || "",
          billingCountry: prev.billingCountry || defaultAddress?.country || user.address?.country || "NL",
          newsletter: prev.newsletter || user.preferences?.newsletter || false,
        };
      });
    }
  }, [isLoggedIn, user]);

  // Redirect if cart is empty, but wait a bit to make sure cart items are loaded
  useEffect(() => {
    // Set a small timeout to ensure the cart items are loaded from localStorage
    const redirectTimer = setTimeout(() => {
      if (items.length === 0) {
        router.push("/");
      }
    }, 300); // 300ms delay to give localStorage time to load

    return () => clearTimeout(redirectTimer);
  }, [items, router]);

  // Fetch orders and extract unique addresses (only once per session)
  useEffect(() => {
    if (isLoggedIn && user && !hasFetchedOrdersRef.current) {
      // Mark as fetched BEFORE making the call to prevent race conditions
      hasFetchedOrdersRef.current = true;
      
      // Fetch the latest orders only once
      fetchOrders();
    }
  }, [isLoggedIn, user, fetchOrders]);

  // Helper function to generate consistent address ID like WordPress plugin
  const generateAddressId = (street: string, postalCode: string): string => {
    // Use CRC32-like hash which is more predictable than trying to replicate MD5
    const text = street + postalCode;
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to positive hex string
    const result = Math.abs(hash).toString(16);
    return result;
  };

  useEffect(() => {
    if (currentStep === 2) {
      const scrollToOverview = () => {
        const el = document.getElementById("over-view-section");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          // try again next frame until it exists
          requestAnimationFrame(scrollToOverview);
        }
      };
      requestAnimationFrame(scrollToOverview);
    }
  }, [currentStep]);

  // Process orders to extract unique addresses
  useEffect(() => {
    if ((orders && orders.length > 0) || user?.address?.street) {
      // Get deleted addresses from localStorage
      const deletedAddressIds = JSON.parse(
        localStorage.getItem("deletedAddresses") || "[]"
      );

      // Create a map to track unique addresses by street
      const addressMap = new Map();

      // Add addresses from user profile
      if (user?.addresses && user.addresses.length > 0) {
        user.addresses.forEach((address) => {
          const fullStreet = `${address.street} ${address.houseNumber}${
            address.houseAddition || ""
          }`;
          const addressKey =
            `${fullStreet}-${address.postalCode}`.toLowerCase();
          const addressId = generateAddressId(fullStreet, address.postalCode);

          if (!deletedAddressIds.includes(addressId)) {
            addressMap.set(addressKey, {
              id: addressId,
              name:
                address.label ||
                (address.isDefault ? "Standaard adres" : "Opgeslagen adres"),
              fullName: `${address.firstName || user.firstName} ${
                address.lastName || user.lastName
              }`,
              street: fullStreet,
              city: address.city,
              postalCode: address.postalCode,
              country: address.country,
            });
          }
        });
      }
      // Add current user address first (if available) - for backwards compatibility
      else if (user?.address?.street) {
        const userAddressKey =
          `${user.address.street}-${user.address.postalCode}`.toLowerCase();
        const addressId = generateAddressId(
          user.address.street,
          user.address.postalCode
        );

        // Only add if not deleted
        if (!deletedAddressIds.includes(addressId)) {
          addressMap.set(userAddressKey, {
            id: addressId,
            name: `Adres van ${user.firstName} ${user.lastName}`,
            fullName: `${user.firstName} ${user.lastName}`,
            street: user.address.street,
            city: user.address.city,
            postalCode: user.address.postalCode,
            country: user.address.country,
          });
        }
      }

      // Extract addresses from orders
      orders.forEach((order, index) => {
        if (order.shippingAddress) {
          const address = order.shippingAddress;
          const addressKey =
            `${address.street}-${address.postalCode}`.toLowerCase();
          // Use the same ID generation as WordPress plugin
          const addressId = generateAddressId(
            address.street,
            address.postalCode
          );

          // Only add if not already in the map and not deleted
          if (
            !addressMap.has(addressKey) &&
            address.street &&
            address.postalCode &&
            !deletedAddressIds.includes(addressId)
          ) {
            addressMap.set(addressKey, {
              id: addressId,
              name: `Adres van ${address.name || "vorige bestelling"}`,
              fullName:
                address.name ||
                `${user?.firstName || ""} ${user?.lastName || ""}`,
              street: address.street,
              city: address.city,
              postalCode: address.postalCode,
              country: address.country || "NL",
            });
          }
        }
      });

      // Convert map to array
      const uniqueAddresses = Array.from(addressMap.values());

      setPreviousAddresses(uniqueAddresses);

      // Auto-select first address if no address is selected yet
      if (uniqueAddresses.length > 0 && !formData.selectedAddressId) {
        const firstAddress = uniqueAddresses[0];
        setFormData((prev) => ({
          ...prev,
          selectedAddressId: firstAddress.id,
          billingAddress: firstAddress.street.split(" ").slice(0, -1).join(" "), // Extract street name without house number
          billingHouseNumber: firstAddress.street.split(" ").slice(-1)[0], // Extract house number (last part)
          billingHouseAddition: "", // Reset addition when selecting pre-saved address
          billingCity: firstAddress.city,
          billingPostcode: firstAddress.postalCode,
          billingCountry: firstAddress.country,
        }));
      }
    }
  }, [orders, user, addressRefresh]);

  // Improved drag handlers with better UX
  const handleMouseDown = (e: React.MouseEvent) => {
    const container = e.currentTarget as HTMLElement;
    setIsDragging(false); // Reset initially
    setStartX(e.pageX);
    setScrollLeft(container.scrollLeft);
    container.style.userSelect = "none";

    // Add global mouse events for better tracking
    const handleGlobalMouseMove = (moveEvent: MouseEvent) => {
      const diff = Math.abs(moveEvent.pageX - startX);
      if (diff > 5) {
        // Only start dragging after 5px movement
        setIsDragging(true);
        container.style.cursor = "grabbing";
      }
      if (isDragging) {
        moveEvent.preventDefault();
        const walk = (moveEvent.pageX - startX) * 1.5; // Reduced speed for better control
        container.scrollLeft = scrollLeft - walk;
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      container.style.cursor = "";
      container.style.userSelect = "";
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Handled by global event listeners now
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Handled by global event listeners now
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    // No longer needed with global listeners
  };

  // Wheel scroll handler for horizontal scrolling
  const handleWheel = (e: React.WheelEvent) => {
    const container = e.currentTarget as HTMLElement;
    if (e.deltaY !== 0) {
      e.preventDefault();
      container.scrollLeft += e.deltaY;

      // Check if scrolled from start position
      if (container.scrollLeft > 0) {
        setHasScrolled(true);
      } else {
        setHasScrolled(false);
      }

      // Check if can scroll right
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      if (container.scrollLeft >= maxScrollLeft - 10) {
        // 10px tolerance
        setCanScrollRight(false);
      } else {
        setCanScrollRight(true);
      }
    }
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    const container = e.currentTarget as HTMLElement;
    setIsDragging(true);
    setStartX(e.touches[0].pageX - container.offsetLeft);
    setScrollLeft(container.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const container = e.currentTarget as HTMLElement;
    const x = e.touches[0].pageX - container.offsetLeft;
    const walk = (x - startX) * 2;
    container.scrollLeft = scrollLeft - walk;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Enhanced email validation function
  const validateEmail = (
    email: string
  ): { isValid: boolean; error?: string } => {
    try {
      // Basic email validation with Zod
      emailSchema.parse(email);

      // Check for disposable email
      const domain = email.split("@")[1]?.toLowerCase();
      if (domain && disposableEmailDomains.has(domain)) {
        return {
          isValid: false,
          error: "Wegwerp e-mailadressen zijn niet toegestaan",
        };
      }

      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { isValid: false, error: error.issues[0].message };
      }
      return { isValid: false, error: "Ongeldig e-mailadres" };
    }
  };

  // Phone validation function for Dutch/Belgian numbers
  const validatePhone = (
    phone: string
  ): { isValid: boolean; error?: string } => {
    if (!phone || !phone.trim()) {
      return {
        isValid: false,
        error: "Telefoonnummer is verplicht",
      };
    }

    // Remove all spaces, dashes, and other common separators
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");

    // Dutch mobile numbers (06 or +316)
    const mobileRegex = /^(\+31|0031|0)6[0-9]{8}$/;
    
    // Dutch landline numbers (010-088, excluding 06)
    const landlineRegex = /^(\+31|0031|0)[1-5,7-9][0-9]{8}$/;
    
    // Belgian mobile numbers (+32 or 0032 or 0)
    const belgianMobileRegex = /^(\+32|0032|0)4[0-9]{8}$/;

    if (mobileRegex.test(cleaned) || landlineRegex.test(cleaned) || belgianMobileRegex.test(cleaned)) {
      return { isValid: true };
    }

    // Provide specific error messages
    if (cleaned.length < 10) {
      return {
        isValid: false,
        error: "Telefoonnummer is te kort (minimaal 10 cijfers)",
      };
    }

    if (cleaned.length > 13) {
      return {
        isValid: false,
        error: "Telefoonnummer is te lang",
      };
    }

    return {
      isValid: false,
      error: "Voer een geldig Nederlands of Belgisch telefoonnummer in",
    };
  };

  // Check if email exists in WordPress/WooCommerce
  const checkEmailExists = async (email: string): Promise<boolean> => {
    if (!email || !email.trim()) return false;
    
    try {
      setIsCheckingEmail(true);
      
      // Use the new exists endpoint that checks both WooCommerce customers and WordPress users
      const response = await fetch(
        `/api/woocommerce/customers/exists?email=${encodeURIComponent(email)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error("Error checking email:", error);
      return false;
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Auto-check email when it changes (handles auto-fill scenarios)
  useEffect(() => {
    // Skip if user is already logged in
    if (isLoggedIn) return;
    
    // Skip if email is empty or invalid
    if (!formData.email || !formData.email.trim()) {
      setEmailRecognized(false);
      return;
    }
    
    // Validate email format first
    const validation = validateEmail(formData.email);
    if (!validation.isValid) {
      setEmailRecognized(false);
      return;
    }
    
    // Debounce the email check
    const timeoutId = setTimeout(async () => {
      const exists = await checkEmailExists(formData.email);
      setEmailRecognized(exists);
    }, 800); // Wait 800ms after last change
    
    return () => clearTimeout(timeoutId);
  }, [formData.email, isLoggedIn]);

  // 🚀 AUTO-TRACK PRE-FILLED EMAIL
  // Tracks customer when email is already filled (e.g., from localStorage or autocomplete)
  useEffect(() => {
    // Skip if email is empty or invalid
    if (!formData.email || !formData.email.trim()) {
      return;
    }
    
    // Skip if this email was already tracked
    if (trackedEmailRef.current === formData.email) {
      return;
    }
    
    // Validate email format
    const validation = validateEmail(formData.email);
    if (!validation.isValid) {
      return;
    }
    
    // Debounce tracking to avoid triggering on every keystroke
    const timeoutId = setTimeout(() => {
      console.log('[Auto-Tracking] ✅ Email detected, triggering tracking:', formData.email);
      trackCheckoutEmail(formData.email).catch(err => {
        console.warn('[Auto-Tracking] Silent error:', err);
      });
      
      // Mark this email as tracked
      trackedEmailRef.current = formData.email;
    }, 1500); // Wait 1.5 seconds after last change (longer than email check)
    
    return () => clearTimeout(timeoutId);
  }, [formData.email]); // Triggers whenever email changes (including initial load)

  // Reset confirmation when phone number changes
  useEffect(() => {
    setAddressMismatchConfirmed(false);
  }, [formData.phone]);

  // Check for address mismatch based on phone number + last name (database lookup)
  useEffect(() => {
    // Skip if user is logged in (they're already verified)
    if (isLoggedIn) {
      setKnownAddressForPhone(null);
      setShowAddressMismatchWarning(false);
      return;
    }
    
    // Skip if no phone number
    if (!formData.phone || !formData.phone.trim()) {
      setKnownAddressForPhone(null);
      setShowAddressMismatchWarning(false);
      return;
    }
    
    // Skip if no last name (required for security verification)
    if (!formData.lastName || !formData.lastName.trim()) {
      setKnownAddressForPhone(null);
      setShowAddressMismatchWarning(false);
      return;
    }
    
    // Skip if address fields are not filled yet
    if (!formData.billingAddress || !formData.billingCity || !formData.billingPostcode) {
      setKnownAddressForPhone(null);
      setShowAddressMismatchWarning(false);
      return;
    }
    
    // Skip if user already confirmed the mismatch
    if (addressMismatchConfirmed) {
      return;
    }
    
    // Debounce the phone lookup
    const timeoutId = setTimeout(async () => {
      try {
        // Use the WordPress custom endpoint for efficient SQL-based search
        // Requires BOTH phone AND last name for security
        const wpApiUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://wasgeurtje.nl';
        const response = await fetch(
          `${wpApiUrl}/wp-json/custom/v1/orders-by-phone?phone=${encodeURIComponent(formData.phone)}&last_name=${encodeURIComponent(formData.lastName)}`
        );
        
        if (!response.ok) {
          console.error("Failed to lookup phone:", response.status);
          return;
        }
        
        const data = await response.json();
        
        if (data.found && data.order) {
          const knownAddress = {
            street: data.order.billing.fullAddress,
            city: data.order.billing.city,
            postalCode: data.order.billing.postcode,
            country: data.order.billing.country,
          };
          
          setKnownAddressForPhone(knownAddress);
          
          // Now check if current address differs from known address
          const currentFullAddress = `${formData.billingAddress} ${formData.billingHouseNumber}${formData.billingHouseAddition || ""}`.trim();
          const currentPostcode = formData.billingPostcode.replace(/\s/g, "").toUpperCase();
          const knownPostcode = knownAddress.postalCode.replace(/\s/g, "").toUpperCase();
          
          // Case-insensitive comparison for all address fields
          const addressesDiffer = 
            currentFullAddress.toLowerCase().trim() !== knownAddress.street.toLowerCase().trim() ||
            formData.billingCity.toLowerCase().trim() !== knownAddress.city.toLowerCase().trim() ||
            currentPostcode !== knownPostcode;
          
          if (addressesDiffer) {
            setShowAddressMismatchWarning(true);
          } else {
            setShowAddressMismatchWarning(false);
          }
        } else {
          setKnownAddressForPhone(null);
          setShowAddressMismatchWarning(false);
        }
      } catch (error) {
        console.error("Error looking up phone:", error);
        setKnownAddressForPhone(null);
        setShowAddressMismatchWarning(false);
      }
    }, 1000); // Wait 1 second after last change
    
    return () => clearTimeout(timeoutId);
  }, [
    isLoggedIn,
    formData.phone,
    formData.lastName, // Required for security verification
    formData.billingAddress,
    formData.billingHouseNumber,
    formData.billingHouseAddition,
    formData.billingCity,
    formData.billingPostcode,
    formData.billingCountry,
    addressMismatchConfirmed,
  ]);

  // Fetch purchase history and generate personalized product suggestion
  useEffect(() => {
    // If free shipping is reached, clear the suggestion
    if (subtotal >= 40) {
      setPersonalizedSuggestion(null);
      return;
    }

    const fetchPurchaseHistoryAndSuggest = async () => {
      try {
        let purchasedProductIds: string[] = [];
        
        // For logged-in users: Use orders from AuthContext (no API call needed!)
        if (isLoggedIn && orders) {
          purchasedProductIds = extractPurchasedProductIds(orders);
          setPurchaseHistory(purchasedProductIds);
        }
        // For non-logged-in users: Try to fetch by phone + last name
        else if (!isLoggedIn && formData.phone && formData.lastName) {
          const wpApiUrl = process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://wasgeurtje.nl';
          const response = await fetch(
            `${wpApiUrl}/wp-json/custom/v1/orders-by-phone?phone=${encodeURIComponent(formData.phone)}&last_name=${encodeURIComponent(formData.lastName)}`
          );
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.found && data.order) {
              // Fetch the full order details to get line items (purchased products)
              const wcApiUrl = process.env.NEXT_PUBLIC_WOOCOMMERCE_API_URL || 'https://wasgeurtje.nl/wp-json/wc/v3';
              const wcKey = process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_KEY;
              const wcSecret = process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_SECRET;
              
              if (wcKey && wcSecret) {
                const orderResponse = await fetch(
                  `${wcApiUrl}/orders/${data.order.orderId}`,
                  {
                    headers: {
                      'Authorization': 'Basic ' + btoa(`${wcKey}:${wcSecret}`),
                    },
                  }
                );
                
                if (orderResponse.ok) {
                  const orderData = await orderResponse.json();
                  purchasedProductIds = orderData.line_items?.map((item: any) => item.product_id.toString()) || [];
                  setPurchaseHistory(purchasedProductIds);
                }
              }
            }
          }
        }
        
        // Count how many suggested products are already in cart
        const suggestedProductsInCart = ["334999", "267628", "335060"].filter(
          id => items.some(item => item.id === id)
        ).length;
        
        // Use central suggestion logic
        const suggestion = getSmartProductSuggestion(
          purchasedProductIds,
          items,
          subtotal,
          suggestedProductsInCart > 0
        );
        
        if (suggestion) {
          // Fetch product info
          const productResponse = await fetch(`/api/woocommerce/products?ids=${suggestion.productId}`);
          
          if (productResponse.ok) {
            const productData = await productResponse.json();
            const product = Array.isArray(productData) ? productData[0] : productData;
            
            setPersonalizedSuggestion({
              productId: suggestion.productId,
              title: product.name || product.title,
              price: parseFloat(product.price),
              image: product.images?.[0]?.src || product.image || "",
              message: suggestion.message,
            });
            
            // Reset banner interaction state when new suggestion is set
            // This allows the banner to update when cart changes
            setBannerInteracted(false);
            setShowPersonalizedBanner(true);
          }
        } else {
          setPersonalizedSuggestion(null);
        }
      } catch (error) {
        console.error("Error fetching purchase history:", error);
      }
    };

    // Debounce to avoid too many requests
    const timeoutId = setTimeout(fetchPurchaseHistoryAndSuggest, 800);
    return () => clearTimeout(timeoutId);
  }, [formData.phone, formData.lastName, isLoggedIn, subtotal, items, orders]);

  // Banner animation timer - toggle between original and personalized
  useEffect(() => {
    if (!personalizedSuggestion || bannerInteracted) {
      return; // Don't animate if no suggestion or user has interacted
    }

    // Show personalized banner immediately when suggestion changes
    setShowPersonalizedBanner(true);

    // Then toggle every 4 seconds
    const interval = setInterval(() => {
      setShowPersonalizedBanner((prev) => !prev);
    }, 4000);

    return () => {
      clearInterval(interval);
    };
  }, [personalizedSuggestion, bannerInteracted]);

  // Handle adding personalized suggestion to cart
  const handleAddPersonalizedSuggestion = async () => {
    if (!personalizedSuggestion || isAddingToCart) return;

    setIsAddingToCart(true);
    setBannerInteracted(true); // Lock banner on click
    setShowPersonalizedBanner(true); // Keep showing personalized banner

    try {
      // Check if product is already in cart
      const existingItem = items.find((item) => item.id === personalizedSuggestion.productId);

      if (existingItem) {
        // Increase quantity
        updateQuantity(personalizedSuggestion.productId, existingItem.variant, existingItem.quantity + 1);
      } else {
        // Add new item to cart
        addToCart({
          id: personalizedSuggestion.productId,
          title: personalizedSuggestion.title,
          price: personalizedSuggestion.price,
          quantity: 1,
          image: personalizedSuggestion.image,
        });
      }

      // Show success feedback for 3 seconds
      setTimeout(() => {
        setIsAddingToCart(false);
      }, 2000);
    } catch (error) {
      console.error("Error adding to cart:", error);
      setIsAddingToCart(false);
    }
  };

  // Handle address deletion
  const handleDeleteAddress = async (addressId: string) => {
    // Remove from local state immediately
    setPreviousAddresses((prev) =>
      prev.filter((addr) => addr.id !== addressId)
    );

    // Save deleted address ID to localStorage
    const deletedAddresses = JSON.parse(
      localStorage.getItem("deletedAddresses") || "[]"
    );
    if (!deletedAddresses.includes(addressId)) {
      deletedAddresses.push(addressId);
      localStorage.setItem(
        "deletedAddresses",
        JSON.stringify(deletedAddresses)
      );
    }

    // If deleted address was selected, clear selection
    if (formData.selectedAddressId === addressId) {
      setFormData((prev) => ({
        ...prev,
        selectedAddressId: "",
        billingAddress: "",
        billingHouseNumber: "",
        billingHouseAddition: "",
        billingCity: "",
        billingPostcode: "",
        billingCountry: "NL",
      }));
    }

    // Trigger re-render of address list
    setAddressRefresh((prev) => prev + 1);
    console.log("🔄 Triggered address refresh");

    // Try to call WordPress API in background (optional)
    if (user?.email) {
      try {
        const response = await fetch(
          "/api/woocommerce/customer/address/delete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: user.email,
              addressId: addressId,
            }),
          }
        );

        if (response.ok) {
          console.log(
            "✅ Successfully called WordPress API for address deletion"
          );
        } else {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          console.log(
            "⚠️ WordPress API call failed (this is OK):",
            response.status,
            errorData
          );
        }
      } catch (error) {
        console.log("⚠️ WordPress API call failed (this is OK):", error);
        // Silently fail - local deletion already succeeded
      }
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Email validation
    if (name === "email") {
      if (value) {
        const validation = validateEmail(value);
        if (!validation.isValid) {
          setEmailError(validation.error || "Voer een geldig e-mailadres in");
          setEmailSuggestion(null);
        } else {
          setEmailError("");
          // Check for typos when email is valid using @zootools/email-spell-checker
          const suggestion = emailSpellChecker.run({ email: value });
          if (suggestion?.full) {
            setEmailSuggestion(suggestion.full);
          } else {
            setEmailSuggestion(null);
          }
        }
      } else {
        setEmailError("");
        setEmailSuggestion(null);
      }
    }

    // Phone validation
    if (name === "phone") {
      if (value) {
        const validation = validatePhone(value);
        if (!validation.isValid) {
          setPhoneError(validation.error || "Voer een geldig telefoonnummer in");
        } else {
          setPhoneError("");
        }
      } else {
        setPhoneError("");
      }
    }

    // Country selection handling
    if (name === "billingCountry") {
      const isNetherlands = value === "NL";
      setIsNetherlandsSelected(isNetherlands);

      // Clear postcode related fields and errors when switching away from Netherlands
      if (!isNetherlands) {
        setPostcodeError("");
        setAddressFound(false);
        setShowManualAddressInput(true); // Always show manual input for non-NL countries
        setIsLookingUpPostcode(false);
      } else {
        setShowManualAddressInput(false); // Hide manual input for Netherlands (use postcode lookup)
      }
    }

    // Clear postcode error and reset states when user types
    if (
      name === "billingPostcode" ||
      name === "billingHouseNumber" ||
      name === "billingHouseAddition"
    ) {
      setPostcodeError("");
      setAddressFound(false);
      setShowManualAddressInput(false);
    }

    // Clear shipping postcode error and reset states when user types
    if (
      name === "shippingPostcode" ||
      name === "shippingHouseNumber" ||
      name === "shippingHouseAddition"
    ) {
      setShippingPostcodeError("");
      setShippingAddressFound(false);
      setShowManualShippingAddressInput(false);
    }
  };

  // Postcode lookup function
  const lookupPostcode = async () => {
    // Only lookup postcodes for Netherlands
    if (!isNetherlandsSelected || formData.billingCountry !== "NL") {
      return;
    }

    if (!formData.billingPostcode || !formData.billingHouseNumber) {
      return;
    }

    setIsLookingUpPostcode(true);
    setPostcodeError("");
    setShowManualAddressInput(false);
    setAddressFound(false);

    try {
      const response = await fetch(
        `/api/postcode?postcode=${encodeURIComponent(
          formData.billingPostcode
        )}&houseNumber=${encodeURIComponent(
          formData.billingHouseNumber
        )}&addition=${encodeURIComponent(formData.billingHouseAddition || "")}`
      );

      if (!response.ok) {
        const errorData = await response.json();

        // Handle invalid postcode format gracefully
        if (errorData.message === "Ongeldige postcode formaat") {
          setPostcodeError("Controleer je postcode (bijv. 1234AB)");
        } else if (errorData.exception === "Combination does not exist." || errorData.message?.includes("Combination does not exist")) {
          setPostcodeError("Deze combinatie van postcode en huisnummer bestaat niet. Voer je adres handmatig in.");
        } else {
          setPostcodeError(errorData.message || "Adres niet gevonden");
        }

        setAddressFound(false);
        setShowManualAddressInput(true);

        // Clear the auto-filled fields when API fails
        setFormData((prev) => ({
          ...prev,
          billingAddress: "",
          billingCity: "",
        }));
        return;
      }

      const data = await response.json();

      // Update form with the found address (street ONLY; number/addition are separate fields)
      setFormData((prev) => ({
        ...prev,
        billingAddress: data.street,
        billingCity: data.city,
        billingCountry: "NL",
      }));

      setAddressFound(true);
      setShowManualAddressInput(false);
    } catch (error) {
      // Only log network errors, not validation errors
      if (error instanceof TypeError) {
        console.error("Network error during postcode lookup:", error);
        setPostcodeError("Verbindingsfout. Probeer het opnieuw.");
      } else {
        setPostcodeError("Controleer je postcode en huisnummer");
      }

      setAddressFound(false);
      setShowManualAddressInput(true);

      // Clear the auto-filled fields when API fails
      setFormData((prev) => ({
        ...prev,
        billingAddress: "",
        billingCity: "",
      }));
    } finally {
      setIsLookingUpPostcode(false);
    }
  };

  // Shipping postcode lookup function
  const lookupShippingPostcode = async () => {
    if (!formData.shippingPostcode || !formData.shippingHouseNumber) {
      return;
    }

    // Only perform postcode lookup for Netherlands
    if (formData.shippingCountry !== "NL") {
      return;
    }

    setIsLookingUpShippingPostcode(true);
    setShippingPostcodeError("");
    setShowManualShippingAddressInput(false);
    setShippingAddressFound(false);

    try {
      const response = await fetch(
        `/api/postcode?postcode=${encodeURIComponent(
          formData.shippingPostcode
        )}&houseNumber=${encodeURIComponent(
          formData.shippingHouseNumber
        )}&addition=${encodeURIComponent(formData.shippingHouseAddition || "")}`
      );

      if (!response.ok) {
        const errorData = await response.json();

        // Handle invalid postcode format gracefully
        if (errorData.message === "Ongeldige postcode formaat") {
          setShippingPostcodeError("Controleer je postcode (bijv. 1234AB)");
        } else {
          setShippingPostcodeError(errorData.message || "Adres niet gevonden");
        }

        setShippingAddressFound(false);
        setShowManualShippingAddressInput(true);

        // Clear the auto-filled fields when API fails
        setFormData((prev) => ({
          ...prev,
          shippingAddress: "",
          shippingCity: "",
        }));
        return;
      }

      const data = await response.json();

      // Update form with the found shipping address (street ONLY)
      setFormData((prev) => ({
        ...prev,
        shippingAddress: data.street,
        shippingCity: data.city,
        shippingCountry: "NL",
      }));

      setShippingAddressFound(true);
      setShowManualShippingAddressInput(false);
    } catch (error) {
      // Only log network errors, not validation errors
      if (error instanceof TypeError) {
        console.error("Network error during shipping postcode lookup:", error);
        setShippingPostcodeError("Verbindingsfout. Probeer het opnieuw.");
      } else {
        setShippingPostcodeError("Controleer je postcode en huisnummer");
      }

      setShippingAddressFound(false);
      setShowManualShippingAddressInput(true);

      // Clear the auto-filled fields when API fails
      setFormData((prev) => ({
        ...prev,
        shippingAddress: "",
        shippingCity: "",
      }));
    } finally {
      setIsLookingUpShippingPostcode(false);
    }
  };

  // Popup new address postcode lookup function
  const lookupNewAddressPostcode = async () => {
    if (!newAddress.postcode || !newAddress.houseNumber) {
      return;
    }

    // Only perform postcode lookup for Netherlands
    if (newAddress.country !== "NL") {
      return;
    }

    setIsLookingUpNewAddress(true);
    setNewAddressError("");
    setNewAddressFound(false);

    try {
      const response = await fetch(
        `/api/postcode?postcode=${encodeURIComponent(
          newAddress.postcode
        )}&houseNumber=${encodeURIComponent(
          newAddress.houseNumber
        )}&addition=${encodeURIComponent(newAddress.addition || "")}`
      );

      if (!response.ok) {
        const errorData = await response.json();

        // Handle invalid postcode format gracefully
        if (errorData.message === "Ongeldige postcode formaat") {
          setNewAddressError("Controleer je postcode (bijv. 1234AB)");
        } else if (errorData.exception === "Combination does not exist." || errorData.message?.includes("Combination does not exist")) {
          setNewAddressError("Deze combinatie van postcode en huisnummer bestaat niet. Voer je adres handmatig in.");
          setShowManualNewAddressInput(true);
        } else {
          setNewAddressError(errorData.message || "Adres niet gevonden");
        }

        setNewAddressFound(false);
        setShowManualNewAddressInput(true);

        // Clear the auto-filled fields when API fails
        setNewAddress((prev) => ({
          ...prev,
          street: "",
          city: "",
        }));
        return;
      }

      const data = await response.json();

      // Update form with the found address (street ONLY)
      setNewAddress((prev) => ({
        ...prev,
        street: data.street,
        city: data.city,
        country: "NL",
      }));

      setNewAddressFound(true);
    } catch (error) {
      // Only log network errors, not validation errors
      if (error instanceof TypeError) {
        console.error("Network error during new address postcode lookup:", error);
        setNewAddressError("Verbindingsfout. Probeer het opnieuw.");
      } else {
        setNewAddressError("Controleer je postcode en huisnummer");
      }

      setNewAddressFound(false);
      setShowManualNewAddressInput(true);

      // Clear the auto-filled fields when there's an error
      setNewAddress((prev) => ({
        ...prev,
        street: "",
        city: "",
      }));
    } finally {
      setIsLookingUpNewAddress(false);
    }
  };

  // Handle save new address
  const handleSaveNewAddress = () => {
    // Validate required fields
    if (!newAddress.postcode || !newAddress.houseNumber) {
      setNewAddressError("Postcode en huisnummer zijn verplicht");
      return;
    }
    
    if (!newAddress.street || !newAddress.city) {
      setNewAddressError("Vul eerst je postcode en huisnummer in om het adres op te zoeken");
      return;
    }

    // Pre-fill firstName and lastName if not provided
    const firstName = newAddress.firstName || formData.firstName || user?.firstName || "";
    const lastName = newAddress.lastName || formData.lastName || user?.lastName || "";
    const middleName = newAddress.middleName || "";
    
    // Create full name
    const fullName = middleName 
      ? `${firstName} ${middleName} ${lastName}`.trim()
      : `${firstName} ${lastName}`.trim();
    
    // Create full street address
    const fullStreet = `${newAddress.street} ${newAddress.houseNumber}${newAddress.addition || ""}`.trim();
    
    // Generate address ID
    const addressId = generateAddressId(fullStreet, newAddress.postcode);
    
    // Create new address object
    const newAddressObj = {
      id: addressId,
      name: newAddress.label || "Nieuw adres",
      fullName: fullName,
      street: fullStreet,
      city: newAddress.city,
      postalCode: newAddress.postcode,
      country: newAddress.country,
      isDefault: newAddress.setAsDefaultShipping, // Track if it's the default
    };
    
    // Add to previous addresses list - position based on whether it's default or not
    setPreviousAddresses((prev) => {
      if (newAddress.setAsDefaultShipping) {
        // If default, add at the beginning
        return [newAddressObj, ...prev];
      } else {
        // If not default, add as second item (after first existing address)
        if (prev.length > 0) {
          return [prev[0], newAddressObj, ...prev.slice(1)];
        } else {
          // If no previous addresses, just add it
          return [newAddressObj];
        }
      }
    });
    
    // Select this address
    setFormData((prev: any) => ({
      ...prev,
      selectedAddressId: addressId,
      billingAddress: newAddress.street,
      billingHouseNumber: newAddress.houseNumber,
      billingHouseAddition: newAddress.addition || "",
      billingCity: newAddress.city,
      billingPostcode: newAddress.postcode,
      billingCountry: newAddress.country,
    }));
    
    // Reset form and close popup
    setNewAddress({
      label: "",
      firstName: "",
      middleName: "",
      lastName: "",
      postcode: "",
      houseNumber: "",
      addition: "",
      street: "",
      city: "",
      country: "NL",
      setAsDefaultShipping: false,
      setAsDefaultBilling: false,
    });
    setNewAddressError("");
    setNewAddressFound(false);
    setShowManualNewAddressInput(false);
    setShowNewAddressForm(false);
    setShowAddressManagementPopup(false);
    
    // Scroll to the newly selected address after a short delay to ensure DOM has updated
    setTimeout(() => {
      if (addressScrollContainerRef.current) {
        const container = addressScrollContainerRef.current;
        const selectedCard = container.querySelector('[data-selected="true"]');
        if (selectedCard) {
          selectedCard.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'start'
          });
        }
      }
    }, 100);
  };

  // Apply discount code function (with optional code parameter for direct application)
  const applyDiscountCode = async (codeToApply?: string) => {
    const codeValue = codeToApply || discountCode;
    
    if (!codeValue.trim()) {
      setDiscountError("Voer een kortingscode in");
      return;
    }

    setIsApplyingDiscount(true);
    setDiscountError("");

    try {
      // Call WooCommerce API to validate coupon
      const response = await fetch(`/api/woocommerce/coupons/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coupon_code: codeValue,
          subtotal: subtotal,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Ongeldige kortingscode");
      }

      const couponData = await response.json();

      // Apply the discount
      setAppliedDiscount({
        code: codeValue,
        amount: couponData.discount_amount,
        type: couponData.discount_type === "percent" ? "percentage" : "fixed",
      });

      setDiscountCode("");
    } catch (error) {
      console.error("Discount code error:", error);
      setDiscountError(
        error instanceof Error
          ? error.message
          : "Kortingscode kon niet worden toegepast"
      );
      setAppliedDiscount(null);
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  // Remove discount
  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountError("");
  };

  // Fetch real product data from WooCommerce API
  const fetchProductsByIds = async (productIds: string[]) => {
    try {
      const response = await fetch(
        `/api/woocommerce/products?ids=${productIds.join(",")}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  };

  // Open products popup and load all products (excluding cart items)
  const openProductsPopup = async () => {
    setShowProductsPopup(true);

    // Get products excluding those already in cart
    try {
      const cartProductIds = new Set(items.map((item) => item.id));
      const availableProductIds = BEST_SELLING_PRODUCT_IDS.filter(
        (id) => !cartProductIds.has(id)
      );

      if (availableProductIds.length === 0) {
        setAllProducts([]);
        return;
      }

      const wcProducts = await fetchProductsByIds(availableProductIds);

      // Filter out products that are out of stock
      const inStockProducts = wcProducts.filter((product: any) => 
        product.stock_status !== 'outofstock'
      );

      const transformedProducts = inStockProducts.map((product: any) => ({
        id: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        badge: getProductBadge(product.id),
        in_cart: false, // Always false since we filter out cart items
        quantity: 1, // Default quantity for popup
      }));

      setAllProducts(transformedProducts);
    } catch (error) {
      console.error("Error loading products for popup:", error);
    }
  };

  // Toggle product selection in popup
  const toggleProductSelection = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  // Update quantity for a product in popup
  const updatePopupQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    setAllProducts((prevProducts) =>
      prevProducts.map((product) =>
        product.id === productId
          ? { ...product, quantity: newQuantity }
          : product
      )
    );
  };

  // Add selected products to cart with their quantities
  const addSelectedProductsToCart = () => {
    selectedProducts.forEach((productId) => {
      const product = allProducts.find((p) => p.id === productId);
      if (product) {
        // Add the product with the specified quantity
        const cartItem: CartItem = {
          id: product.id,
          title: product.title,
          price: product.price,
          image: product.image,
          quantity: product.quantity || 1,
        };
        addToCart(cartItem);
      }
    });

    // Reset selection and close popup
    setSelectedProducts(new Set());
    setShowProductsPopup(false);
  };

  // Enhanced addToCart function with product rotation
  const addToCartWithRotation = (product: {
    id: string;
    title: string;
    price: number;
    image: string;
  }) => {
    addToCart(product);

    // Log the addition for rotation logic
  };

  // Best selling product IDs (based on WooCommerce data) - updated with valid IDs
  const BEST_SELLING_PRODUCT_IDS = [
    "335706",
    "335060",
    "334999",
    "267628",
    "273942",
    "273946",
    "273947",   
    "273949",
  ];

  // Badge mapping for products
  const getProductBadge = (productId: string) => {
    const badgeMap: Record<string, string> = {
      "335706": "#1 Combideal",
      "335060": "Bestseller",
      "334999": "Premium",
      "267628": "Nieuw",
      "273942": "Premium",
      "273946": "Premium",
      "273947": "Premium",
      "273949": "Premium",
    };
    return badgeMap[productId] || "Populair";
  };

  // Get product IDs user hasn't ordered before (for logged in users)
  const getUnorderedProductIds = () => {
    // Get product IDs already in cart
    const cartProductIds = new Set(items.map((item) => item.id));

    if (!isLoggedIn || !orders || orders.length === 0) {
      // For non-logged users, exclude cart items
      return BEST_SELLING_PRODUCT_IDS.filter(
        (productId) => !cartProductIds.has(productId)
      );
    }

    // Extract all product IDs from user's order history with frequency
    const orderedProductIds = new Set<string>();
    const orderFrequency: Record<string, number> = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        orderedProductIds.add(item.id);
        orderFrequency[item.id] =
          (orderFrequency[item.id] || 0) + item.quantity;
      });
    });

    // First priority: Products never ordered before (excluding cart items)
    const neverOrdered = BEST_SELLING_PRODUCT_IDS.filter(
      (productId) =>
        !orderedProductIds.has(productId) && !cartProductIds.has(productId)
    );

    if (neverOrdered.length > 0) {
      return neverOrdered;
    }

    // Fallback: Previously ordered products (most frequently ordered first, excluding cart items)
    const previouslyOrdered = Object.entries(orderFrequency)
      .filter(([productId]) => !cartProductIds.has(productId)) // Exclude cart items
      .sort(([, freqA], [, freqB]) => freqB - freqA) // Sort by frequency (highest first)
      .map(([productId]) => productId)
      .filter((productId) => BEST_SELLING_PRODUCT_IDS.includes(productId)); // Only include our product pool

    return previouslyOrdered;
  };

  // Get best selling product IDs (for non-logged users, excluding cart items)
  const getBestSellingProductIds = () => {
    // Get product IDs already in cart
    const cartProductIds = new Set(items.map((item) => item.id));

    // Filter out products already in cart
    return BEST_SELLING_PRODUCT_IDS.filter(
      (productId) => !cartProductIds.has(productId)
    );
  };

  // Update suggested products when user login status or orders change
  useEffect(() => {
    const loadProducts = async () => {
      setIsLoadingProducts(true);

      try {
        let productIds: string[] = [];

        if (isLoggedIn && user) {
          productIds = getUnorderedProductIds();
        } else {
          productIds = getBestSellingProductIds();
        }

        if (productIds.length > 0) {
          // Fetch real product data from WooCommerce - get up to 6 products for rotation
          const wcProducts = await fetchProductsByIds(productIds.slice(0, 6));

          // Filter out products that are out of stock
          const inStockProducts = wcProducts.filter((product: any) => 
            product.stock_status !== 'outofstock'
          );

          // Transform to our format with badges (no cart status needed since we filter them out)
          const transformedProducts = inStockProducts.map((product: any) => ({
            id: product.id,
            title: product.title,
            price: product.price,
            image: product.image,
            description:
              product.description ||
              `Geniet van deze ${product.title.toLowerCase()}`,
            badge: getProductBadge(product.id),
            inCart: false, // Always false since we only fetch non-cart products
          }));

          // Show the fetched products (already filtered to exclude cart items)
          setSuggestedProducts(transformedProducts.slice(0, 2)); // Always exactly 2 suggestions
        } else {
          setSuggestedProducts([]);
        }
      } catch (error) {
        console.error("Error loading suggested products:", error);
        setSuggestedProducts([]);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    loadProducts();
  }, [isLoggedIn, user, orders, items]);

  const calculateShipping = () => {
    return subtotal >= 40 ? 0 : 4.95;
  };

  const calculateVolumeDiscount = () => {
    // 10% volume discount when subtotal is €75 or more
    if (!FeatureFlags.ENABLE_VOLUME_DISCOUNT) return 0; // Feature disabled
    if (subtotal >= 75) {
      return subtotal * 0.1;
    }
    return 0;
  };

  const calculateBundleDiscount = () => {
    return Math.max(0, bundleDiscount || 0);
  };

  const calculateDiscount = () => {
    if (!appliedDiscount) return 0;

    if (appliedDiscount.type === "percentage") {
      return (subtotal * appliedDiscount.amount) / 100;
    } else {
      return appliedDiscount.amount;
    }
  };

  const calculateTotal = () => {
    const shipping = calculateShipping();
    const discount = calculateDiscount();
    const volumeDiscount = calculateVolumeDiscount();
    const bundle = calculateBundleDiscount();
    return Math.max(0, subtotal + shipping - discount - volumeDiscount - bundle);
  };

  // Memoize orderData to prevent infinite re-renders in PaymentPage
  const memoizedOrderData = useMemo(() => {
    // Calculate discount inline
    const discountAmount = appliedDiscount
      ? appliedDiscount.type === "percentage"
        ? (subtotal * appliedDiscount.amount) / 100
        : appliedDiscount.amount
      : 0;

    // Calculate volume discount inline
    const volumeDiscount = subtotal >= 150 ? subtotal * 0.1 : 0;
    const bundle = calculateBundleDiscount();

    // Calculate shipping inline
    const shippingCost = subtotal >= 40 ? 0 : 4.95;

    // Calculate final total inline
    const finalTotal = Math.max(0, subtotal + shippingCost - discountAmount - volumeDiscount - bundle);

    // Convert appliedDiscount to API format
    const apiDiscount = appliedDiscount
      ? {
          coupon_code: appliedDiscount.code,
          discount_type:
            appliedDiscount.type === "percentage" ? "percent" : "fixed_cart",
          discount_amount: discountAmount,
        }
      : undefined;

    console.log("🔄 Memoizing orderData:", {
      hasAppliedDiscount: !!appliedDiscount,
      appliedDiscount: appliedDiscount,
      apiDiscount: apiDiscount,
      discountAmount: discountAmount,
      finalTotal: finalTotal,
      currentStep: currentStep,
    });

    const newOrderData = {
      customer: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        companyName: formData.companyName,
        address: formData.billingAddress,
        houseNumber: formData.billingHouseNumber,
        houseAddition: formData.billingHouseAddition,
        postcode: formData.billingPostcode,
        city: formData.billingCity,
        shippingAddress: formData.shippingAddress,
        shippingHouseNumber: formData.shippingHouseNumber,
        shippingHouseAddition: formData.shippingHouseAddition,
        shippingPostcode: formData.shippingPostcode,
        shippingCity: formData.shippingCity,
        useShippingAddress: formData.useShippingAddress,
      },
      lineItems: items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
      })),
      appliedDiscount: apiDiscount,
      totals: {
        subtotal: subtotal,
      discountAmount: discountAmount,
      volumeDiscount: volumeDiscount,
      bundleDiscount: bundle,
        shippingCost: shippingCost,
        finalTotal: finalTotal,
      },
      finalTotal: finalTotal,
    };

    // Always return the latest orderData
    // The PaymentPage component will handle payment intent updates via useEffect
    return newOrderData;
  }, [
    currentStep,
    formData.firstName,
    formData.lastName,
    formData.email,
    formData.phone,
    formData.companyName,
    formData.billingAddress,
    formData.billingHouseNumber,
    formData.billingHouseAddition,
    formData.billingPostcode,
    formData.billingCity,
    formData.shippingAddress,
    formData.shippingHouseNumber,
    formData.shippingHouseAddition,
    formData.shippingPostcode,
    formData.shippingCity,
    formData.useShippingAddress,
    items,
    subtotal,
    appliedDiscount,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!formData.email) {
      setError("E-mailadres is verplicht");
      setEmailError("E-mailadres is verplicht");
      return;
    }

    const emailValidation = validateEmail(formData.email);
    if (!emailValidation.isValid) {
      setError(emailValidation.error || "Voer een geldig e-mailadres in");
      setEmailError(emailValidation.error || "Voer een geldig e-mailadres in");
      return;
    }

    // Phone validation
    if (!formData.phone?.trim()) {
      setError("Telefoonnummer is verplicht");
      setPhoneError("Telefoonnummer is verplicht");
      // Scroll to phone field
      const phoneField = document.getElementById("phone");
      if (phoneField) {
        phoneField.scrollIntoView({ behavior: "smooth", block: "center" });
        phoneField.focus();
      }
      return;
    }

    const phoneValidation = validatePhone(formData.phone);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.error || "Voer een geldig telefoonnummer in");
      setPhoneError(phoneValidation.error || "Voer een geldig telefoonnummer in");
      // Scroll to phone field
      const phoneField = document.getElementById("phone");
      if (phoneField) {
        phoneField.scrollIntoView({ behavior: "smooth", block: "center" });
        phoneField.focus();
      }
      return;
    }

    // Validate form
    if (!formData.acceptTerms) {
      setError("Je moet de algemene voorwaarden accepteren");
      return;
    }

    if (items.length === 0) {
      setError("Je winkelwagen is leeg");
      return;
    }

    setIsProcessing(true);

    try {
      // Helper function to map cart IDs to WooCommerce IDs
      const mapCartIdToWooCommerceId = (cartId: string): string => {
        const mapping: Record<string, string> = {
          "trial-pack": "334999",
          "blossom-drip": "1410",
          "full-moon": "1425",
          wasstrips: "335060",
          // Add more mappings as needed
        };
        return mapping[cartId] || cartId;
      };

      // Prepare line items for API with mapped IDs
      const lineItems = items.map((item) => ({
        id: mapCartIdToWooCommerceId(item.id),
        quantity: item.quantity,
      }));

      // Prepare customer data
      const customer = {
        customerId: isLoggedIn && user ? user.id : null,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,

        // Billing address
        address: formData.billingAddress,
        houseNumber: formData.billingHouseNumber,
        houseAddition: formData.billingHouseAddition,
        city: formData.billingCity,
        postcode: formData.billingPostcode,
        country: formData.billingCountry,

        // Shipping address (if different)
        useShippingAddress: formData.useShippingAddress,
        shippingAddress: formData.shippingAddress,
        shippingHouseNumber: formData.shippingHouseNumber,
        shippingHouseAddition: formData.shippingHouseAddition,
        shippingCity: formData.shippingCity,
        shippingPostcode: formData.shippingPostcode,
      };

      // Calculate final total for display
      const finalTotal = calculateTotal();

      // Calculate totals for API
      const totals = {
        subtotal: subtotal,
        discountAmount: calculateDiscount(),
        volumeDiscount: calculateVolumeDiscount(),
        bundleDiscount: calculateBundleDiscount(),
        shippingCost: subtotal >= 40 ? 0 : 4.95,
        finalTotal: finalTotal,
      };

      // Convert appliedDiscount to API format
      const apiDiscount = appliedDiscount
        ? {
            coupon_code: appliedDiscount.code,
            discount_type:
              appliedDiscount.type === "percentage" ? "percent" : "fixed_cart",
            discount_amount: calculateDiscount(), // Use calculated discount amount
          }
        : undefined;

      // Prepare order data for payment
      const orderData = {
        lineItems,
        customer,
        appliedDiscount: apiDiscount,
        totals,
        finalTotal,
      };

      // Store order data in sessionStorage for payment page
      sessionStorage.setItem("pendingOrder", JSON.stringify(orderData));
      setCurrentStep(2);

      // Redirect to payment page
      // router.push("/checkout/payment");
    } catch (err) {
      console.error("Checkout error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Er is iets misgegaan. Probeer het opnieuw."
      );
      setIsProcessing(false);
    }
  };

  // for autofill address lookup tigger
  useEffect(() => {
    // Only run for Netherlands with complete address data
    if (
      isNetherlandsSelected &&
      formData.billingCountry === "NL" &&
      formData.billingPostcode &&
      formData.billingPostcode.length >= 6 && // Basic postcode validation
      formData.billingHouseNumber &&
      formData.billingHouseNumber.trim() !== "" &&
      !addressFound && // Don't run if address was already found
      !isLookingUpPostcode && // Don't run if already looking up
      !showManualAddressInput // Don't run if manual input is shown
    ) {
      // Use a ref to track the last looked up combination to prevent duplicate calls
      const currentLookupKey = `${formData.billingPostcode}-${formData.billingHouseNumber}-${formData.billingHouseAddition}`;

      const timer = setTimeout(() => {
        lookupPostcode();
      }, 1000); // 1 second debounce

      return () => clearTimeout(timer);
    }
  }, [
    isNetherlandsSelected,
    formData.billingCountry,
    formData.billingPostcode,
    formData.billingHouseNumber,
    formData.billingHouseAddition,
    addressFound,
    isLookingUpPostcode,
    showManualAddressInput,
    lookupPostcode, // Add this dependency
  ]);
  // end autofill address lookup trigger
  
  // Popup new address autofill lookup trigger
  useEffect(() => {
    // Only run when popup is open and form is shown
    if (
      showAddressManagementPopup &&
      showNewAddressForm &&
      newAddress.country === "NL" &&
      newAddress.postcode &&
      newAddress.postcode.length >= 6 && // Basic postcode validation
      newAddress.houseNumber &&
      newAddress.houseNumber.trim() !== "" &&
      !newAddressFound && // Don't run if address was already found
      !isLookingUpNewAddress && // Don't run if already looking up
      !showManualNewAddressInput // Don't run if manual input is shown
    ) {
      const timer = setTimeout(() => {
        lookupNewAddressPostcode();
      }, 1000); // 1 second debounce

      return () => clearTimeout(timer);
    }
  }, [
    showAddressManagementPopup,
    showNewAddressForm,
    newAddress.country,
    newAddress.postcode,
    newAddress.houseNumber,
    newAddress.addition,
    newAddressFound,
    isLookingUpNewAddress,
    showManualNewAddressInput,
  ]);
  
  const { showRedemptionPopup, openRedemptionPopup, closeRedemptionPopup } =
    useLoyality();
  
  // Wrapper function to check if user is logged in before opening redemption popup
  const handleOpenRedemptionPopup = () => {
    if (!isLoggedIn || !user) {
      setAuthPopupMessage("Log in om je loyalty punten te beheren en kortingscodes te verzilveren.");
      setShowAuthPopup(true);
    } else {
      openRedemptionPopup();
    }
  };
  // put these near your other helpers/state
  const isBillingAddressComplete = () => {
    // If a saved address (NOT "new") is selected, we're good
    if (
      isLoggedIn &&
      formData.selectedAddressId &&
      formData.selectedAddressId !== "new"
    ) {
      return true;
    }

    // Otherwise, require manual fields to be filled
    return Boolean(
      formData.billingAddress?.trim() &&
        formData.billingHouseNumber?.trim() &&
        formData.billingPostcode?.trim() &&
        formData.billingCity?.trim() &&
        formData.billingCountry?.trim()
    );
  };

  // Get list of missing required fields
  const getMissingFields = () => {
    const missing: string[] = [];
    
    if (!formData.firstName?.trim()) missing.push('Voornaam');
    if (!formData.lastName?.trim()) missing.push('Achternaam');
    if (!formData.email?.trim()) missing.push('E-mailadres');
    if (!formData.phone?.trim()) missing.push('Telefoonnummer');
    
    // Check address fields if no saved address is selected
    if (
      !isLoggedIn ||
      !formData.selectedAddressId ||
      formData.selectedAddressId === "new"
    ) {
      if (!formData.billingCountry?.trim()) missing.push('Land');
      if (!formData.billingPostcode?.trim()) missing.push('Postcode');
      if (!formData.billingHouseNumber?.trim()) missing.push('Huisnummer');
      if (!formData.billingAddress?.trim()) missing.push('Straat');
      if (!formData.billingCity?.trim()) missing.push('Plaats');
    }
    
    return missing;
  };

  const isNextButtonDisabled = () => {
    if (!formData.firstName?.trim()) return true;
    if (!formData.lastName?.trim()) return true;
    if (!formData.email?.trim()) return true;
    if (!formData.phone?.trim()) return true;
    return !isBillingAddressComplete();
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {/* Analytics Tracking for Checkout */}
      <CheckoutTracker 
        email={formData.email} 
        step={currentStep === 1 ? 'payment' : 'details'} 
      />
      
      <div className={`min-h-screen bg-[#F4F2EB] ${isShippingBarDismissed || isMobileMenuOpen ? 'shipping-bar-hidden' : ''}`}>
        {/* Sticky Shipping Bar - Mobile Only - Only shows when scrolled DOWN and header is hidden */}
        {/* Now alternates with personalized suggestion */}
        {/* Hidden when address popup is visible to prevent overlap */}
        {!isShippingBarDismissed && !isMobileMenuOpen && !showMainHeader && !showAddressMismatchWarning && (
          <div className="checkout-sticky-bar fixed top-0 left-0 right-0 z-[60] md:hidden overflow-hidden">
            {/* Shipping Bar - Alternates with personalized suggestion */}
            {(!personalizedSuggestion || !showPersonalizedBanner || bannerInteracted) && (
              <div className={`transition-all duration-500 ${personalizedSuggestion && !bannerInteracted && showPersonalizedBanner ? 'opacity-0 absolute inset-0' : 'opacity-100'}`}>
                {subtotal < 40 ? (
                  // Progress bar when working towards free shipping
                  <div className="bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] text-white px-3 py-3 shadow-xl shadow-[#d7aa43]/40 border-b-2 border-[#f5d68a]/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {/* Animated Truck Icon */}
                        <div className="flex-shrink-0 bg-white/20 p-1.5 rounded-lg">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                          </svg>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-[13px] font-semibold leading-snug">
                              Nog €{(40 - subtotal).toFixed(2)} voor GRATIS verzending!
                            </p>
                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-semibold leading-tight">
                              {Math.round((subtotal / 40) * 100)}%
                            </span>
                          </div>
                          
                          {/* Enhanced Progress Bar */}
                          <div className="relative w-full bg-white/30 rounded-full h-1.5 overflow-hidden shadow-inner">
                            <div 
                              className="absolute inset-0 bg-gradient-to-r from-white via-white to-white/80 h-1.5 rounded-full transition-all duration-500 ease-out shadow-sm"
                              style={{ width: `${Math.min((subtotal / 40) * 100, 100)}%` }}
                            >
                              <div className="absolute inset-0 bg-white/40 animate-pulse"></div>
                            </div>
                            {/* Goal indicator */}
                            <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/50"></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-1.5">
                        {/* Savings Badge */}
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1 text-center flex-shrink-0 border border-white/30">
                          <p className="text-xs font-bold whitespace-nowrap leading-tight">€4,95</p>
                          <p className="text-[9px] font-semibold opacity-90 leading-tight">bespaar</p>
                        </div>
                        
                        {/* Close button */}
                        <button
                          onClick={() => setIsShippingBarDismissed(true)}
                          className="flex-shrink-0 p-1 hover:bg-white/20 rounded-md transition-all duration-200 hover:scale-110 active:scale-95"
                          aria-label="Sluit verzendkosten banner"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Success message when free shipping achieved
                  <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 text-white px-3 py-3 shadow-xl shadow-emerald-500/40 border-b-2 border-emerald-300/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        {/* Success Checkmark Icon */}
                        <div className="flex-shrink-0 bg-white/20 p-1.5 rounded-lg">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-semibold leading-snug">
                              Gratis verzending! 🎉
                            </p>
                            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-semibold leading-tight">
                              €4,95 voordeel
                            </span>
                          </div>
                          <p className="text-[11px] opacity-90 mt-0.5 leading-tight">
                            Je bespaart op verzendkosten
                          </p>
                        </div>
                      </div>
                      
                      {/* Close button */}
                      <button
                        onClick={() => setIsShippingBarDismissed(true)}
                        className="flex-shrink-0 p-1 hover:bg-white/20 rounded-md transition-all duration-200 hover:scale-110 active:scale-95"
                        aria-label="Sluit verzendkosten banner"
                      >
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Personalized Product Suggestion - Alternates with shipping bar */}
            {personalizedSuggestion && showPersonalizedBanner && !bannerInteracted && (
              <div className="bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] text-white px-3 py-3 shadow-xl shadow-[#d7aa43]/40 border-b-2 border-[#f5d68a]/30 transition-all duration-500">
                <div className="flex items-start gap-2">
                  {/* Product Image */}
                  <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg overflow-hidden shadow-md">
                    <img 
                      src={personalizedSuggestion.image} 
                      alt={personalizedSuggestion.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Message and Title */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold leading-snug">
                      {personalizedSuggestion.message}
                    </p>
                    <p className="text-[11px] opacity-90 leading-tight mt-0.5">
                      {personalizedSuggestion.title}
                    </p>
                  </div>

                  {/* Price and CTA */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-xs font-bold whitespace-nowrap leading-tight">
                      €{personalizedSuggestion.price.toFixed(2)}
                    </p>
                    <button
                      onClick={handleAddPersonalizedSuggestion}
                      disabled={isAddingToCart}
                      className={`
                        px-2.5 py-1 rounded-md font-semibold text-[10px] transition-all duration-300 whitespace-nowrap
                        ${isAddingToCart
                          ? 'bg-green-500 text-white cursor-default'
                          : 'bg-white text-[#d7aa43] hover:bg-[#f5d68a] shadow-md hover:shadow-lg'
                        }
                      `}
                    >
                      {isAddingToCart ? '✓' : '+'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress Bar - Add padding for header on mobile (no extra padding for sticky bar since it only shows when header is hidden) */}
        <div className={`bg-white border-b md:pt-0 pt-[96px]`}>
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-center">
              {CHECKOUT_STEPS.map((step, index) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`flex items-center transition-colors ${
                      index + 1 <= maxStepReached
                        ? "cursor-pointer hover:opacity-80"
                        : "cursor-not-allowed opacity-50"
                    } ${
                      index + 1 <= currentStep
                        ? "text-[#d7aa43]"
                        : "text-gray-400"
                    }`}
                    onClick={() => handleStepClick(index)}
                    title={
                      index + 1 <= maxStepReached
                        ? `Ga naar ${step}`
                        : `${step} - Nog niet beschikbaar`
                    }
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                        index + 1 <= currentStep
                          ? "border-[#f5d68a] bg-gradient-to-br from-[#e8b960] via-[#d7aa43] to-[#c29635] text-white shadow-lg shadow-[#d7aa43]/50"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {index + 1 < currentStep ? (
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>
                    <span className="ml-2 text-sm font-medium hidden sm:inline">
                      {step}
                    </span>
                  </div>
                  {index < CHECKOUT_STEPS.length - 1 && (
                    <div
                      className={`w-12 sm:w-24 h-1 mx-2 ${
                        index + 1 < currentStep ? "bg-[#d7aa43]" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-3">
          {/* Product Upsell Banner - Hide on Gegevens step (step 1) */}
          <div
            className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg relative overflow-hidden"
            style={{ display: currentStep === 1 ? "none" : "block" }}
          >
            <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8">
              <div className="w-32 h-32 bg-green-100 rounded-full opacity-50"></div>
            </div>
            
            {/* Dropdown Header - Always Visible */}
            <button
              type="button"
              onClick={() => setIsProductSuggestionsOpen(!isProductSuggestionsOpen)}
              className="w-full p-4 flex items-center justify-between hover:bg-green-100/50 transition-colors relative z-10"
            >
              <div className="flex items-center gap-3">
                {subtotal >= 40 ? (
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19.5 12.5l-1.5-3h-3v-2c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h.76c.55 1.19 1.74 2 3.24 2s2.69-.81 3.24-2h3.52c.55 1.19 1.74 2 3.24 2s2.69-.81 3.24-2h.76c.55 0 1-.45 1-1v-3.5c0-.83-.67-1.5-1.5-1.5zm-11.5 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm8 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3-3h-3v-2.5h2.5l.5 1v1.5z" />
                    </svg>
                  </div>
                )}
                <div className="text-left">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">
                    {subtotal >= 40 ? "Gratis verzending behaald! 🌟" : `Nog €${(40 - subtotal).toFixed(2)} voor GRATIS verzending!`}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {subtotal >= 40 ? "Ontdek meer geweldige producten" : "Voeg producten toe en bespaar €4,95"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {subtotal >= 40 && (
                  <p className="text-xs text-green-600 font-medium hidden sm:block">
                    €4,95 bespaard
                  </p>
                )}
                <svg
                  className={`w-5 h-5 text-gray-700 transition-transform duration-200 flex-shrink-0 ${
                    isProductSuggestionsOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Dropdown Content */}
            {isProductSuggestionsOpen && (
              <div className={`relative z-10 border-t border-green-200 ${subtotal >= 40 ? "p-4" : "p-6"}`}>
              {subtotal < 40 && (
                // Full layout when working towards free shipping
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M19.5 12.5l-1.5-3h-3v-2c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h.76c.55 1.19 1.74 2 3.24 2s2.69-.81 3.24-2h3.52c.55 1.19 1.74 2 3.24 2s2.69-.81 3.24-2h.76c.55 0 1-.45 1-1v-3.5c0-.83-.67-1.5-1.5-1.5zm-11.5 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm8 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3-3h-3v-2.5h2.5l.5 1v1.5z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      Nog maar €{(40 - subtotal).toFixed(2)} voor GRATIS
                      verzending!
                    </h3>
                    <p className="text-sm text-gray-700 mb-3">
                      Voeg nog een klein item toe aan je bestelling en bespaar
                      €4,95 op verzendkosten
                    </p>

                    {/* Progress bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>€{subtotal.toFixed(2)}</span>
                        <span className="font-semibold">
                          €40.00 (Gratis verzending)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 relative">
                        <div
                          className="bg-gradient-to-r from-green-400 to-green-500 h-3 rounded-full transition-all duration-300 flex items-center justify-end pr-1"
                          style={{
                            width: `${Math.min((subtotal / 40) * 100, 100)}%`,
                          }}
                        >
                          <div className="w-5 h-5 bg-white rounded-full shadow-md border-2 border-green-500"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Product Suggestions */}
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${
                  subtotal >= 40 ? "mt-3" : "mt-0"
                }`}
              >
                {isLoadingProducts
                  ? // Loading skeleton
                    Array.from({ length: 2 }).map((_, index) => (
                      <div
                        key={`loading-${index}`}
                        className="bg-white rounded-lg p-3 border border-gray-200 animate-pulse"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded mb-1"></div>
                            <div className="h-3 bg-gray-200 rounded w-16"></div>
                          </div>
                          <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
                        </div>
                      </div>
                    ))
                  : suggestedProducts.map((product) => (
                      <div
                        key={product.id}
                        className="bg-white rounded-lg p-3 border border-gray-200 hover:border-green-400 transition-colors"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                            <img
                              src={product.image}
                              alt={product.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = "none";
                                const parent = target.parentElement;
                                if (parent) {
                                  parent.innerHTML =
                                    '<span class="text-2xl">📦</span>';
                                }
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {product.title}
                              </h4>
                              {product.badge && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full text-white ${
                                    product.badge.includes("Nieuw")
                                      ? "bg-blue-500"
                                      : product.badge.includes("Bestseller")
                                      ? "bg-orange-500"
                                      : product.badge.includes("Premium")
                                      ? "bg-purple-500"
                                      : "bg-green-500"
                                  }`}
                                >
                                  {product.badge}
                                </span>
                              )}
                              {isLoggedIn && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  Nieuw voor jou!
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-green-600 mt-1">
                              €{product.price.toFixed(2)}
                            </p>
                          </div>
                          {product.inCart ? (
                            <div className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full border border-green-300 flex items-center gap-1">
                              <svg
                                className="w-3 h-3"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Toegevoegd
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                addToCartWithRotation({
                                  id: product.id,
                                  title: product.title,
                                  price: product.price,
                                  image: product.image,
                                });
                              }}
                              className="px-3 py-1 bg-green-500 text-white text-sm rounded-full hover:bg-green-600 transition-colors"
                            >
                              + Toevoegen
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                {/* Show message if no suitable products */}
                {!isLoadingProducts && suggestedProducts.length === 0 && (
                  <div className="col-span-2 text-center py-4 text-gray-500">
                    <p className="text-sm">
                      {isLoggedIn
                        ? "Je hebt al onze populairste producten geprobeerd! 🎉"
                        : "Bekijk onze shop voor meer geweldige producten!"}
                    </p>
                  </div>
                )}
              </div>

              {/* Alternative CTA */}
              <div className="mt-4 text-center" id="over-view-section">
                <button
                  onClick={openProductsPopup}
                  className="text-sm text-[#d7aa43] underline hover:no-underline inline-flex items-center gap-1 cursor-pointer"
                >
                  Bekijk alle producten
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
              </div>
            )}
          </div>
        </div>

        {/* Volume Discount Achieved Banner */}
        {FeatureFlags.ENABLE_VOLUME_DISCOUNT && subtotal >= 75 && (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-lg">%</span>
              </div>
              <div>
                <h3 className="font-semibold text-purple-900">
                  Fantastisch! Je krijgt 10% VOLUME KORTING
                </h3>
                <p className="text-sm text-purple-700">
                  Je bespaart €{(subtotal * 0.1).toFixed(2)} extra op deze
                  bestelling!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* upsell */}
        <div className="upsell">
          <div className="container mx-auto px-4 md:py-8 pt-0 pb-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Step 1: Checkout Form */}
                {currentStep === 1 && (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Contact Information */}
                    <div className="bg-white rounded-lg p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">
                          Contactgegevens
                        </h2>
                        {/* Wijzig knop voor ingelogde gebruikers met opgeslagen gegevens */}
                        {isLoggedIn && user && (user.firstName || user.lastName || user.phone) && (
                          <button
                            type="button"
                            onClick={() => setIsEditingContactDetails(!isEditingContactDetails)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d7aa43] text-black rounded-lg font-medium text-xs hover:bg-[#c29635] transition-all duration-200"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              {isEditingContactDetails ? (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              ) : (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              )}
                            </svg>
                            {isEditingContactDetails ? "Opslaan" : "Wijzig gegevens"}
                          </button>
                        )}
                      </div>
                      {!isLoggedIn && (
                        <div className="mb-4 p-4 bg-[#f8f5ed] rounded-lg">
                          <p className="text-sm">
                            Heb je al een account?{" "}
                            <button
                              onClick={() => setShowAuthPopup(true)}
                              className="text-[#d7aa43] underline hover:no-underline cursor-pointer"
                            >
                              Log in of registreer je
                            </button>
                          </p>
                        </div>
                      )}
                      
                      {/* Info bericht voor ingelogde gebruikers met afgeschermde gegevens */}
                      {isLoggedIn && user && (user.firstName || user.lastName || user.phone) && !isEditingContactDetails && (
                        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                          <svg
                            className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-900">
                              Je opgeslagen gegevens worden gebruikt
                            </p>
                            <p className="text-sm text-blue-700 mt-1">
                              Klik op "Wijzig gegevens" als je deze wilt aanpassen.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <label
                            htmlFor="email"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            E-mailadres *
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg
                                className="h-5 w-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                            </div>
                            <input
                              type="email"
                              id="email"
                              name="email"
                              value={formData.email}
                              onChange={handleInputChange}
                              onBlur={async () => {
                                if (formData.email) {
                                  const validation = validateEmail(
                                    formData.email
                                  );
                                  if (!validation.isValid) {
                                    setEmailError(
                                      validation.error ||
                                        "Voer een geldig e-mailadres in"
                                    );
                                    setEmailSuggestion(null);
                                    setEmailRecognized(false);
                                  } else {
                                    // Check for typos on blur
                                    const suggestion = emailSpellChecker.run({
                                      email: formData.email,
                                    });
                                    if (
                                      suggestion?.full &&
                                      suggestion.full !== formData.email
                                    ) {
                                      setEmailSuggestion(suggestion.full);
                                    }
                                    
                                    // Check if email exists (only if not logged in)
                                    if (!isLoggedIn) {
                                      const exists = await checkEmailExists(formData.email);
                                      setEmailRecognized(exists);
                                    }

                                    // 🎯 TRACK CUSTOMER: IP, Geo, Profile Recalculation
                                    // In checkout: ONLY track data, NO popup (user is already converting)
                                    trackCheckoutEmail(formData.email).catch(err => {
                                      console.warn('[Tracking] Silent error:', err);
                                    });
                                  }
                                }
                              }}
                              required
                              readOnly={(isLoggedIn && user && !isEditingContactDetails) ? true : undefined}
                              className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent ${
                                emailError
                                  ? "border-red-300"
                                  : "border-gray-300"
                              } ${isLoggedIn && user && !isEditingContactDetails ? "bg-gray-50 cursor-not-allowed" : ""}`}
                              placeholder="jouwnaam@email.com"
                            />
                          </div>
                          {emailError && (
                            <div className="mt-2 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <svg
                                  className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                <path
                                  fillRule="evenodd"
                                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <p className="text-sm text-red-700 font-medium">
                                {emailError}
                              </p>
                            </div>
                          )}

                          {/* Email recognized - suggest login */}
                          {emailRecognized && !emailError && !isLoggedIn && (
                            <div className="mt-2 flex items-start gap-3 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
                              <svg
                                className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-blue-900 mb-1">
                                  We kennen dit e-mailadres al! 👋
                                </p>
                                <p className="text-sm text-blue-800 mb-3">
                                  Je hebt al een account bij ons. Log in om je opgeslagen adressen en waspunten te gebruiken.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setShowAuthPopup(true)}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
                                      strokeWidth={2}
                                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                                    />
                                  </svg>
                                  Inloggen
                                </button>
                              </div>
                            </div>
                          )}

                          {emailSuggestion && !emailError && (
                            <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <svg
                                className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm text-amber-700 font-medium">
                                  Bedoelde je misschien:
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      email: emailSuggestion,
                                    }));
                                    setEmailSuggestion(null);
                                  }}
                                  className="text-sm text-amber-700 underline hover:no-underline mt-1"
                                >
                                  {emailSuggestion}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label
                              htmlFor="firstName"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Voornaam *
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg
                                  className="h-5 w-5 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                              </div>
                              <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleInputChange}
                                required
                                readOnly={(isLoggedIn && user && !isEditingContactDetails) ? true : undefined}
                                className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent ${
                                  isLoggedIn && user && !isEditingContactDetails ? "bg-gray-50 cursor-not-allowed" : ""
                                }`}
                              />
                            </div>
                          </div>
                          <div>
                            <label
                              htmlFor="lastName"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Achternaam *
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg
                                  className="h-5 w-5 text-gray-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                              </div>
                              <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleInputChange}
                                required
                                readOnly={(isLoggedIn && user && !isEditingContactDetails) ? true : undefined}
                                className={`w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent ${
                                  isLoggedIn && user && !isEditingContactDetails ? "bg-gray-50 cursor-not-allowed" : ""
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label
                            htmlFor="phone"
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            Telefoonnummer *
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg
                                className={`h-5 w-5 ${
                                  phoneError ? "text-red-400" : "text-gray-400"
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                            </div>
                            <input
                              type="tel"
                              id="phone"
                              name="phone"
                              value={formData.phone}
                              onChange={handleInputChange}
                              onBlur={() => {
                                if (formData.phone) {
                                  const validation = validatePhone(formData.phone);
                                  if (!validation.isValid) {
                                    setPhoneError(
                                      validation.error ||
                                        "Voer een geldig telefoonnummer in"
                                    );
                                  }
                                }
                              }}
                              required
                              readOnly={(isLoggedIn && user && !isEditingContactDetails) ? true : undefined}
                              className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent ${
                                phoneError
                                  ? "border-red-300 bg-red-50"
                                  : "border-gray-300"
                              } ${isLoggedIn && user && !isEditingContactDetails ? "bg-gray-50 cursor-not-allowed" : ""}`}
                              placeholder="06-12345678"
                            />
                          </div>
                          {phoneError && (
                            <div className="mt-2 flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                              <svg
                                className="w-4 h-4 flex-shrink-0 mt-0.5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>{phoneError}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Delivery Address */}
                    <div className="bg-white rounded-lg p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-5 h-5 text-[#d7aa43]"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <h2 className="text-xl font-semibold">Bezorgadres</h2>
                        </div>
                        
                        {/* Knop voor wijzigen/toevoegen bezorgadres */}
                        {isLoggedIn && previousAddresses.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddressManagementPopup(true);
                              setShowNewAddressForm(false);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d7aa43] text-black rounded-lg font-medium text-xs hover:bg-[#c29635] transition-all duration-200"
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            <span className="hidden sm:inline">Wijzig of voeg een bezorgadres toe</span>
                            <span className="sm:hidden">Wijzig adres</span>
                          </button>
                        )}
                      </div>

                      {/* Saved Addresses for Logged-in Users */}
                      {isLoggedIn && previousAddresses.length > 0 && (
                        <div className="mb-6">
                          <div className="relative">
                              <>
                                {/* Swipeable container */}
                                <div
                                  ref={addressScrollContainerRef}
                                  className="overflow-x-auto scrollbar-hide"
                                  onMouseDown={handleMouseDown}
                                  onWheel={handleWheel}
                                  onTouchStart={handleTouchStart}
                                  onTouchMove={handleTouchMove}
                                  onTouchEnd={handleTouchEnd}
                                  onScroll={(e) => {
                                    const container = e.currentTarget;
                                    setHasScrolled(container.scrollLeft > 0);

                                    const maxScrollLeft =
                                      container.scrollWidth -
                                      container.clientWidth;
                                    setCanScrollRight(
                                      container.scrollLeft < maxScrollLeft - 10
                                    );
                                  }}
                                  style={{
                                    scrollSnapType: "x mandatory",
                                    WebkitOverflowScrolling: "touch",
                                    cursor: isDragging ? "grabbing" : "grab",
                                  }}
                                >
                                  <div
                                    className="flex gap-4 pb-4"
                                    style={{ scrollSnapType: "x mandatory" }}
                                  >
                                    {/* SAVED ADDRESSES */}
                                    {previousAddresses.map((address, index) => {
                                      const isSelected =
                                        formData.selectedAddressId ===
                                          address.id ||
                                        (!formData.selectedAddressId &&
                                          index === 0);

                                      return (
                                        <div
                                          key={address.id}
                                          data-selected={isSelected ? "true" : "false"}
                                          className={`relative group flex-shrink-0 w-[300px] sm:w-[320px] md:w-[340px] lg:w-[360px] border-2 rounded-xl p-5 cursor-pointer transition-all duration-300 select-none shadow-sm hover:shadow-md ${
                                            isSelected
                                              ? "border-[#0071CE] shadow-lg bg-blue-50 transform"
                                              : "border-gray-300 hover:border-gray-400 bg-white"
                                          }`}
                                          style={{ scrollSnapAlign: "start" }}
                                          onClick={(e) => {
                                            if (isDragging) {
                                              e.preventDefault();
                                              return;
                                            }
                                            setFormData((prev) => ({
                                              ...prev,
                                              selectedAddressId: address.id,
                                              billingAddress: address.street
                                                .split(" ")
                                                .slice(0, -1)
                                                .join(" "),
                                              billingHouseNumber: address.street
                                                .split(" ")
                                                .slice(-1)[0],
                                              billingHouseAddition: "",
                                              billingCity: address.city,
                                              billingPostcode:
                                                address.postalCode,
                                              billingCountry: address.country,
                                            }));
                                          }}
                                          onMouseDown={(e) =>
                                            e.stopPropagation()
                                          }
                                          onTouchStart={(e) =>
                                            e.stopPropagation()
                                          }
                                        >
                                          {/* Delete button */}
                                          <button
                                            className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 p-2 bg-red-50 hover:bg-red-100 rounded-full hover:scale-110"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteAddress(address.id);
                                            }}
                                            type="button"
                                            aria-label="Verwijder adres"
                                          >
                                            <svg
                                              className="w-4 h-4 text-red-600"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                              />
                                            </svg>
                                          </button>

                                          {/* Selected badge - shown when address is selected */}
                                          {isSelected && (
                                            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-[#0071CE] text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg z-10">
                                              <svg
                                                className="w-4 h-4"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                              >
                                                <path
                                                  fillRule="evenodd"
                                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                  clipRule="evenodd"
                                                />
                                              </svg>
                                              <span className="text-white">Geselecteerd</span>
                                            </div>
                                          )}

                                          {/* Address content */}
                                          <div className="flex items-center gap-3 mb-3">
                                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                                              isSelected ? "bg-[#0071CE]/20" : "bg-[#d7aa4319]"
                                            }`}>
                                              <svg
                                                className={`w-6 h-6 ${
                                                  isSelected ? "text-[#0071CE]" : "text-[#d7aa43]"
                                                }`}
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                              >
                                                <path
                                                  fillRule="evenodd"
                                                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                                  clipRule="evenodd"
                                                />
                                              </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <h3 className={`font-semibold text-base truncate ${
                                                isSelected ? "text-[#0071CE]" : "text-gray-900"
                                              }`}>
                                                {address.name}
                                              </h3>
                                              <p className="text-sm text-gray-600 mt-1">
                                                {address.fullName}
                                              </p>
                                            </div>
                                          </div>

                                          <div className="text-sm text-gray-700 leading-relaxed ml-13 space-y-1">
                                            <p className="font-medium text-gray-900">
                                              {address.street}
                                            </p>
                                            <p className="text-gray-600">
                                              {address.postalCode}{" "}
                                              {address.city}
                                            </p>
                                            <p className="text-gray-500 capitalize">
                                              {(() => {
                                                switch (address.country) {
                                                  case "NL":
                                                    return "nederland";
                                                  case "BE":
                                                    return "belgië";
                                                  case "DE":
                                                    return "duitsland";
                                                  default:
                                                    return address.country.toLowerCase();
                                                }
                                              })()}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* ADD NEW ADDRESS CARD */}
                                    <div
                                      className="flex-shrink-0 w-[300px] sm:w-[320px] md:w-[340px] lg:w-[360px] border-2 border-dashed border-gray-300 rounded-xl p-5 cursor-pointer flex items-center justify-center hover:border-[#d7aa43] hover:bg-[#FFF9F0] transition-all duration-300 select-none group"
                                      style={{ scrollSnapAlign: "start" }}
                                      onClick={(e) => {
                                        if (isDragging) {
                                          e.preventDefault();
                                          return;
                                        }
                                        setShowAddressManagementPopup(true);
                                        setShowNewAddressForm(true);
                                      }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onTouchStart={(e) => e.stopPropagation()}
                                    >
                                      <div className="text-center">
                                        <div className="w-12 h-12 bg-gradient-to-br from-[#d7aa43] via-[#e8b960] to-[#c29635] group-hover:shadow-lg group-hover:shadow-[#d7aa43]/40 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-2xl font-light transition-all duration-300 group-hover:scale-110">
                                          <p className="text-white -mt-[8]">
                                            +
                                          </p>
                                        </div>
                                        <p className="text-gray-600 group-hover:text-[#814E1E] text-sm font-medium transition-colors duration-300">
                                          Voeg nieuw adres toe
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Scroll indicators */}
                                <div className="flex justify-center gap-1.5 mt-4">
                                  {previousAddresses.map((address, index) => (
                                    <div
                                      key={`indicator-${address.id}`}
                                      className={`h-2 rounded-full transition-all duration-300 ${
                                        formData.selectedAddressId ===
                                          address.id ||
                                        (!formData.selectedAddressId &&
                                          index === 0)
                                          ? "w-6 bg-[#0071CE]"
                                          : "w-2 bg-gray-300"
                                      }`}
                                    />
                                  ))}
                                  <div
                                    className={`h-2 rounded-full transition-all duration-300 ${
                                      formData.selectedAddressId === "new"
                                        ? "w-6 bg-[#0071CE]"
                                        : "w-2 bg-gray-300"
                                    }`}
                                  />
                                </div>

                                {/* Desktop navigation arrows */}
                                {hasScrolled && (
                                  <button
                                    type="button"
                                    className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg p-3 hover:shadow-xl transition-all hover:scale-105 border border-gray-200 hover:border-gray-300"
                                    onClick={() => {
                                      const container = document.querySelector(
                                        ".overflow-x-auto"
                                      ) as HTMLElement;
                                      if (container) {
                                        container.scrollBy({
                                          left: -350,
                                          behavior: "smooth",
                                        });
                                      }
                                    }}
                                  >
                                    <svg
                                      className="w-6 h-6 text-gray-700"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                    >
                                      <path
                                        d="M15 19l-7-7 7-7"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                )}
                                {canScrollRight && (
                                  <button
                                    type="button"
                                    className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg p-3 hover:shadow-xl transition-all hover:scale-105 border border-gray-200 hover:border-gray-300"
                                    onClick={() => {
                                      const container = document.querySelector(
                                        ".overflow-x-auto"
                                      ) as HTMLElement;
                                      if (container) {
                                        container.scrollBy({
                                          left: 350,
                                          behavior: "smooth",
                                        });
                                      }
                                    }}
                                  >
                                    <svg
                                      className="w-6 h-6 text-gray-700"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                    >
                                      <path
                                        d="M9 5l7 7-7 7"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  </button>
                                )}
                              </>
                          </div>
                        </div>
                      )}

                      {/* Only show manual address entry if no saved address is selected or user has no saved addresses */}
                      {(!isLoggedIn ||
                        previousAddresses.length === 0 ||
                        formData.selectedAddressId === "new") && (
                        <div className="space-y-4">
                          {/* Country selection - Always shown first */}
                          <div>
                            <label
                              htmlFor="billingCountry"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Land *
                            </label>
                            <div className="relative">
                              <svg
                                className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <select
                                id="billingCountry"
                                name="billingCountry"
                                value={formData.billingCountry}
                                onChange={handleInputChange}
                                required
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent appearance-none bg-white"
                              >
                                <option value="NL">Nederland</option>
                                <option value="BE">België</option>
                                <option value="DE">Duitsland</option>
                              </select>
                              <svg
                                className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </div>
                          </div>

                          {/* Postcode and House Number with Auto-lookup - Only for Netherlands */}
                          {isNetherlandsSelected &&
                            formData.billingCountry === "NL" && (
                              <div className="grid sm:grid-cols-3 gap-4">
                                <div>
                                  <label
                                    htmlFor="billingPostcode"
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                  >
                                    Postcode *
                                  </label>
                                  <div className="relative">
                                    <svg
                                      className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <input
                                      type="text"
                                      id="billingPostcode"
                                      name="billingPostcode"
                                      value={formData.billingPostcode}
                                      onChange={handleInputChange}
                                      onBlur={() => {
                                        if (
                                          isNetherlandsSelected &&
                                          formData.billingCountry === "NL" &&
                                          formData.billingPostcode &&
                                          formData.billingHouseNumber &&
                                          !showManualAddressInput
                                        ) {
                                          lookupPostcode();
                                        }
                                      }}
                                      required
                                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                      placeholder="1234 AB"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label
                                    htmlFor="billingHouseNumber"
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                  >
                                    Huisnummer *
                                  </label>
                                  <div className="relative">
                                    <svg
                                      className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                    </svg>
                                    <input
                                      type="text"
                                      id="billingHouseNumber"
                                      name="billingHouseNumber"
                                      value={formData.billingHouseNumber}
                                      onChange={handleInputChange}
                                      onBlur={() => {
                                        if (
                                          isNetherlandsSelected &&
                                          formData.billingCountry === "NL" &&
                                          formData.billingPostcode &&
                                          formData.billingHouseNumber &&
                                          !showManualAddressInput
                                        ) {
                                          lookupPostcode();
                                        }
                                      }}
                                      required
                                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                      placeholder="123"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label
                                    htmlFor="billingHouseAddition"
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                  >
                                    Toevoeging
                                  </label>
                                  <div className="relative">
                                    <svg
                                      className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <input
                                      type="text"
                                      id="billingHouseAddition"
                                      name="billingHouseAddition"
                                      value={formData.billingHouseAddition}
                                      onChange={handleInputChange}
                                      onBlur={() => {
                                        if (
                                          isNetherlandsSelected &&
                                          formData.billingCountry === "NL" &&
                                          formData.billingPostcode &&
                                          formData.billingHouseNumber &&
                                          !showManualAddressInput
                                        ) {
                                          lookupPostcode();
                                        }
                                      }}
                                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                      placeholder="A, B, bis"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                          {/* Manual address input button - Only show for NL when manual input is not active */}
                          {isNetherlandsSelected &&
                            formData.billingCountry === "NL" &&
                            !showManualAddressInput &&
                            !addressFound && (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowManualAddressInput(true);
                                    setPostcodeError("");
                                    setAddressFound(false);
                                  }}
                                  className="text-sm text-[#814E1E] hover:text-[#d7aa43] font-medium flex items-center gap-1.5 transition-colors"
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
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  </svg>
                                  Voer adres handmatig in
                                </button>
                              </div>
                            )}

                          {/* Address lookup status */}
                          {isLookingUpPostcode && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0071CE]"></div>
                              Adres wordt opgezocht...
                            </div>
                          )}

                          {/* Success message when address found */}
                          {addressFound && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-5 h-5 text-green-600"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <p className="text-sm text-green-700">
                                  ✅ Adres gevonden en automatisch ingevuld
                                </p>
                              </div>
                              <div className="mt-2 text-sm text-green-600">
                                <strong>
                                  {`${formData.billingAddress} ${
                                    formData.billingHouseNumber
                                  }${
                                    formData.billingHouseAddition || ""
                                  }`.trim()}
                                </strong>
                                <br />
                                {formData.billingPostcode}{" "}
                                {formData.billingCity}
                              </div>
                            </div>
                          )}

                          {/* Error message with manual input option */}
                          {postcodeError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-sm text-red-700">
                                ⚠️ {postcodeError}
                              </p>
                              {showManualAddressInput && (
                                <p className="text-sm text-gray-600 mt-1">
                                  Vul hieronder uw adresgegevens handmatig in.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Manual address input (shown when API fails for NL or always for other countries) */}
                          {(showManualAddressInput ||
                            (!isNetherlandsSelected &&
                              formData.billingCountry !== "NL")) && (
                            <div className="border-t pt-4 space-y-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <svg
                                    className="w-4 h-4 text-gray-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <h4 className="text-sm font-medium text-gray-700">
                                    {formData.billingCountry !== "NL"
                                      ? "Voer uw adresgegevens in"
                                      : "Adresgegevens handmatig invoeren"}
                                  </h4>
                                </div>
                                {/* Back to automatic lookup button - Only for NL */}
                                {formData.billingCountry === "NL" && showManualAddressInput && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowManualAddressInput(false);
                                      setPostcodeError("");
                                      setAddressFound(false);
                                      // Clear manual fields
                                      setFormData((prev) => ({
                                        ...prev,
                                        billingAddress: "",
                                        billingCity: "",
                                      }));
                                    }}
                                    className="text-xs text-[#814E1E] hover:text-[#d7aa43] font-medium flex items-center gap-1 transition-colors"
                                  >
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                      />
                                    </svg>
                                    Terug naar automatische opzoeking
                                  </button>
                                )}
                              </div>
                              {formData.billingCountry !== "NL" && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                  <p className="text-sm text-blue-800">
                                    <svg
                                      className="w-4 h-4 inline mr-1"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    Automatische postcode opzoekservice is
                                    alleen beschikbaar voor Nederlandse
                                    adressen.
                                  </p>
                                </div>
                              )}

                              <div>
                                <label
                                  htmlFor="billingAddress"
                                  className="block text-sm font-medium text-gray-700 mb-1"
                                >
                                  Straatnaam en huisnummer *
                                </label>
                                <div className="relative">
                                  <svg
                                    className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <input
                                    type="text"
                                    id="billingAddress"
                                    name="billingAddress"
                                    value={formData.billingAddress}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                    placeholder="Straatnaam en huisnummer"
                                  />
                                </div>
                              </div>

                              <div className="grid sm:grid-cols-2 gap-4">
                                <div>
                                  <label
                                    htmlFor="billingPostcode"
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                  >
                                    Postcode *
                                  </label>
                                  <div className="relative">
                                    <svg
                                      className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <input
                                      type="text"
                                      id="billingPostcode"
                                      name="billingPostcode"
                                      value={formData.billingPostcode}
                                      onChange={handleInputChange}
                                      required
                                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                      placeholder={
                                        formData.billingCountry === "BE"
                                          ? "1000"
                                          : formData.billingCountry === "DE"
                                          ? "10115"
                                          : "Postcode"
                                      }
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label
                                    htmlFor="billingCity"
                                    className="block text-sm font-medium text-gray-700 mb-1"
                                  >
                                    Plaats *
                                  </label>
                                  <div className="relative">
                                    <svg
                                      className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                    <input
                                      type="text"
                                      id="billingCity"
                                      name="billingCity"
                                      value={formData.billingCity}
                                      onChange={handleInputChange}
                                      required
                                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                      placeholder="Plaats"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {formData.useShippingAddress && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          <h3 className="font-medium mb-2">Verzendadres</h3>

                          {/* Shipping Postcode and House Number with Auto-lookup */}
                          <div className="grid sm:grid-cols-3 gap-4">
                            <div>
                              <label
                                htmlFor="shippingPostcode"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Postcode *
                              </label>
                              <input
                                type="text"
                                id="shippingPostcode"
                                name="shippingPostcode"
                                value={formData.shippingPostcode}
                                onChange={handleInputChange}
                                onBlur={() => {
                                  if (
                                    formData.shippingPostcode &&
                                    formData.shippingHouseNumber &&
                                    formData.shippingCountry === "NL"
                                  ) {
                                    lookupShippingPostcode();
                                  }
                                }}
                                required={formData.useShippingAddress}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                placeholder="1234 AB"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="shippingHouseNumber"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Huisnummer *
                              </label>
                              <input
                                type="text"
                                id="shippingHouseNumber"
                                name="shippingHouseNumber"
                                value={formData.shippingHouseNumber}
                                onChange={handleInputChange}
                                onBlur={() => {
                                  if (
                                    formData.shippingPostcode &&
                                    formData.shippingHouseNumber &&
                                    formData.shippingCountry === "NL"
                                  ) {
                                    lookupShippingPostcode();
                                  }
                                }}
                                required={formData.useShippingAddress}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                placeholder="123"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor="shippingHouseAddition"
                                className="block text-sm font-medium text-gray-700 mb-1"
                              >
                                Toevoeging
                              </label>
                              <input
                                type="text"
                                id="shippingHouseAddition"
                                name="shippingHouseAddition"
                                value={formData.shippingHouseAddition}
                                onChange={handleInputChange}
                                onBlur={() => {
                                  if (
                                    formData.shippingPostcode &&
                                    formData.shippingHouseNumber &&
                                    formData.shippingCountry === "NL"
                                  ) {
                                    lookupShippingPostcode();
                                  }
                                }}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                placeholder="A, B, bis"
                              />
                            </div>
                          </div>

                          {/* Shipping address lookup status */}
                          {isLookingUpShippingPostcode && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0071CE]"></div>
                              Verzendadres wordt opgezocht...
                            </div>
                          )}

                          {/* Success message when shipping address found */}
                          {shippingAddressFound && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-5 h-5 text-green-600"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <p className="text-sm text-green-700">
                                  ✅ Verzendadres gevonden en automatisch
                                  ingevuld
                                </p>
                              </div>
                              <div className="mt-2 text-sm text-green-600">
                                <strong>{formData.shippingAddress}</strong>
                                <br />
                                {formData.shippingPostcode}{" "}
                                {formData.shippingCity}
                              </div>
                            </div>
                          )}

                          {/* Error message with manual input option for shipping */}
                          {shippingPostcodeError && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                              <p className="text-sm text-red-700">
                                ⚠️ {shippingPostcodeError}
                              </p>
                              {showManualShippingAddressInput && (
                                <p className="text-sm text-gray-600 mt-1">
                                  Vul hieronder uw verzendadres handmatig in.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Manual shipping address input (only shown when API fails) */}
                          {showManualShippingAddressInput && (
                            <div className="border-t pt-4 space-y-4">
                              <h4 className="text-sm font-medium text-gray-700">
                                Verzendadres handmatig invoeren
                              </h4>

                              <div>
                                <label
                                  htmlFor="shippingAddress"
                                  className="block text-sm font-medium text-gray-700 mb-1"
                                >
                                  Straatnaam en huisnummer *
                                </label>
                                <div className="relative">
                                  <svg
                                    className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <input
                                    type="text"
                                    id="shippingAddress"
                                    name="shippingAddress"
                                    value={formData.shippingAddress}
                                    onChange={handleInputChange}
                                    required={formData.useShippingAddress}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                    placeholder="Straatnaam en huisnummer"
                                  />
                                </div>
                              </div>

                              <div>
                                <label
                                  htmlFor="shippingCity"
                                  className="block text-sm font-medium text-gray-700 mb-1"
                                >
                                  Plaats *
                                </label>
                                <div className="relative">
                                  <svg
                                    className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <input
                                    type="text"
                                    id="shippingCity"
                                    name="shippingCity"
                                    value={formData.shippingCity}
                                    onChange={handleInputChange}
                                    required={formData.useShippingAddress}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                    placeholder="Plaats"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          <div>
                            <label
                              htmlFor="shippingCountry"
                              className="block text-sm font-medium text-gray-700 mb-1"
                            >
                              Land *
                            </label>
                            <select
                              id="shippingCountry"
                              name="shippingCountry"
                              value={formData.shippingCountry}
                              onChange={handleInputChange}
                              required={formData.useShippingAddress}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                            >
                              <option value="NL">Nederland</option>
                              <option value="BE">België</option>
                              <option value="DE">Duitsland</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mobile Order Summary Toggle */}
                    <div className="lg:hidden bg-white rounded-lg p-4 shadow-sm">
                      <button
                        type="button"
                        onClick={() => {
                          const summary = document.getElementById(
                            "mobile-order-summary"
                          );
                          if (summary) {
                            summary.classList.toggle("hidden");
                          }
                        }}
                        className="w-full flex items-center justify-between"
                      >
                        <span className="font-medium">Bekijk bestelling</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            €{calculateTotal().toFixed(2)}
                          </span>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </button>
                    </div>

                    {/* Order Summary Sidebar */}
                    <div className="lg:col-span-1 md:block lg:hidden">
                      <div
                        id="order-summary"
                        className="bg-white rounded-xl shadow-lg sticky top-4 hidden lg:block overflow-hidden border border-gray-100"
                      >
                        {/* Premium Header */}
                        <div className="bg-gradient-to-br from-slate-50 to-gray-100 px-6 py-5 border-b-2 border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                                <svg
                                  className="w-6 h-6 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                  Orderoverzicht
                                </h2>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-sm text-gray-600 font-medium">
                                    {items.length} {items.length === 1 ? 'product' : 'producten'}
                                  </span>
                                  <span className="text-gray-300">•</span>
                                  <div className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs text-green-600 font-semibold">
                                      Beveiligd
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Free Shipping Progress Bar */}
                        {subtotal < 40 && (
                          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4 border-b border-blue-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-blue-900">
                                🚚 Nog €{(40 - subtotal).toFixed(2)} voor gratis verzending!
                              </span>
                            </div>
                            <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${Math.min((subtotal / 40) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {subtotal >= 40 && (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-3 border-b border-green-100">
                            <div className="flex items-center justify-center gap-2">
                              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className="text-sm font-semibold text-green-800">
                                Gefeliciteerd! Je krijgt gratis verzending 🎉
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Products Section */}
                        <div className="px-6 py-5 max-h-[400px] overflow-y-auto"
                          style={{
                            scrollbarWidth: 'thin',
                            scrollbarColor: '#d7aa43 #f3f4f6'
                          }}
                        >
                        <div className="space-y-3">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="group relative bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300 hover:border-[#d7aa43]/30"
                            >
                              <div className="flex gap-4">
                                <div className="relative flex-shrink-0">
                                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-white shadow-sm border border-gray-100">
                                    <Image
                                      src={item.image}
                                      alt={item.title || 'Product image'}
                                      width={80}
                                      height={80}
                                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                                    />
                                  </div>
                                  <div className="absolute -top-2 -right-2 bg-gradient-to-br from-[#e8b960] via-[#d7aa43] to-[#c29635] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg shadow-[#d7aa43]/50 border-2 border-white ring-2 ring-[#f5d68a]/30"
                                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                                  >
                                    {item.quantity}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1 min-w-0 pr-2">
                                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
                                        {item.title}
                                      </h3>
                                      {item.variant && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                          {item.variant}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() =>
                                        removeFromCart(item.id, item.variant)
                                      }
                                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                      title="Product verwijderen"
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
                                          strokeWidth={2}
                                          d="M6 18L18 6M6 6l12 12"
                                        />
                                      </svg>
                                    </button>
                                  </div>

                                  {/* Price and Quantity */}
                                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                    <div className="flex flex-col">
                                      <span className="text-xs text-gray-500">
                                        €{item.price.toFixed(2)} per stuk
                                      </span>
                                      <span className="text-lg font-bold text-[#d7aa43] mt-0.5">
                                        €{(item.price * item.quantity).toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
                                      <button
                                        onClick={() =>
                                          updateQuantity(
                                            item.id,
                                            item.variant,
                                            Math.max(1, item.quantity - 1)
                                          )
                                        }
                                        className="px-2.5 py-1.5 text-gray-600 hover:text-[#d7aa43] hover:bg-amber-50 transition-colors rounded-l-md disabled:opacity-30 disabled:cursor-not-allowed"
                                        disabled={item.quantity <= 1}
                                      >
                                        <svg
                                          className="w-3.5 h-3.5"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2.5}
                                            d="M20 12H4"
                                          />
                                        </svg>
                                      </button>
                                      <span className="px-3 text-sm font-bold text-gray-900 min-w-[24px] text-center">
                                        {item.quantity}
                                      </span>
                                      <button
                                        onClick={() =>
                                          updateQuantity(
                                            item.id,
                                            item.variant,
                                            item.quantity + 1
                                          )
                                        }
                                        className="px-2.5 py-1.5 text-gray-600 hover:text-[#d7aa43] hover:bg-amber-50 transition-colors rounded-r-md"
                                      >
                                        <svg
                                          className="w-3.5 h-3.5"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2.5}
                                            d="M12 4v16m8-8H4"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        </div>

                        {/* Selected Address Display */}
                        {(formData.billingAddress ||
                          formData.selectedAddressId ||
                          (formData.useShippingAddress &&
                            formData.shippingAddress)) && (
                          <div className="px-6 py-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-y border-blue-100">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                <svg
                                  className="w-4 h-4 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-gray-900">
                                  Bezorgadres
                                </h3>
                                <p className="text-xs text-blue-600">Levering binnen 1-2 werkdagen</p>
                              </div>
                            </div>
                            <div className="text-sm text-gray-700 space-y-1 bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-blue-200/50">
                              {(() => {
                                // Show shipping address if "Verzenden naar een ander adres" is selected and shipping address is filled
                                if (
                                  formData.useShippingAddress &&
                                  (formData.shippingAddress ||
                                    formData.shippingPostcode)
                                ) {
                                  return (
                                    <div>
                                      {(formData.firstName ||
                                        formData.lastName) && (
                                        <p className="font-medium text-gray-900">
                                          {formData.firstName}{" "}
                                          {formData.lastName}
                                        </p>
                                      )}
                                      {formData.shippingAddress ? (
                                        <>
                                          <p>
                                            {`${formData.shippingAddress} ${
                                              formData.shippingHouseNumber
                                            }${
                                              formData.shippingHouseAddition ||
                                              ""
                                            }`.trim()}
                                          </p>
                                          <p>
                                            {formData.shippingPostcode}{" "}
                                            {formData.shippingCity}
                                          </p>
                                          <p>
                                            {(() => {
                                              switch (
                                                formData.shippingCountry
                                              ) {
                                                case "NL":
                                                  return "Nederland";
                                                case "BE":
                                                  return "België";
                                                case "DE":
                                                  return "Duitsland";
                                                default:
                                                  return formData.shippingCountry;
                                              }
                                            })()}
                                          </p>
                                        </>
                                      ) : (
                                        <p className="text-gray-400 italic">
                                          Verzendadres nog niet ingevuld
                                        </p>
                                      )}
                                    </div>
                                  );
                                }

                                // Otherwise show billing address (default behavior)
                                const selectedAddress = previousAddresses.find(
                                  (addr) =>
                                    addr.id === formData.selectedAddressId
                                );

                                if (selectedAddress) {
                                  return (
                                    <div>
                                      <p className="font-medium text-gray-900">
                                        {selectedAddress.fullName}
                                      </p>
                                      <p>
                                        {formData.billingAddress &&
                                        formData.billingHouseNumber
                                          ? `${formData.billingAddress} ${
                                              formData.billingHouseNumber
                                            }${
                                              formData.billingHouseAddition ||
                                              ""
                                            }`.trim()
                                          : selectedAddress.street.replace(
                                              /\s+(\d+)\s+\1(?:\s|$)/,
                                              " $1"
                                            )}
                                      </p>
                                      <p>
                                        {selectedAddress.postalCode}{" "}
                                        {selectedAddress.city}
                                      </p>
                                      <p>
                                        {(() => {
                                          switch (selectedAddress.country) {
                                            case "NL":
                                              return "Nederland";
                                            case "BE":
                                              return "België";
                                            case "DE":
                                              return "Duitsland";
                                            default:
                                              return selectedAddress.country;
                                          }
                                        })()}
                                      </p>
                                    </div>
                                  );
                                } else if (formData.billingAddress) {
                                  // Fallback to manual address
                                  return (
                                    <div>
                                      {(formData.firstName ||
                                        formData.lastName) && (
                                        <p className="font-medium text-gray-900">
                                          {formData.firstName}{" "}
                                          {formData.lastName}
                                        </p>
                                      )}
                                      <p>
                                        {`${formData.billingAddress} ${
                                          formData.billingHouseNumber
                                        }${
                                          formData.billingHouseAddition || ""
                                        }`.trim()}
                                      </p>
                                      <p>
                                        {formData.billingPostcode}{" "}
                                        {formData.billingCity}
                                      </p>
                                      <p>
                                        {formData.billingCountry === "NL"
                                          ? "Nederland"
                                          : formData.billingCountry}
                                      </p>
                                    </div>
                                  );
                                }
                                return (
                                  <p className="text-gray-400 italic">
                                    Nog geen adres geselecteerd
                                  </p>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        <div className="border-t pt-4 space-y-2">
                          <div className="flex flex-wrap justify-between text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <svg
                                className="w-4 h-4 text-gray-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>Subtotaal</span>
                            </div>
                            <span>€{subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-wrap justify-between text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <svg
                                className="w-4 h-4 text-gray-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-.293-.707L15 4.586A1 1 0 0014.414 4H14v3z" />
                              </svg>
                              <span>Verzending</span>
                            </div>
                            <span>
                              {calculateShipping() === 0
                                ? "Gratis"
                                : `€${calculateShipping().toFixed(2)}`}
                            </span>
                          </div>
                          {appliedDiscount && (
                            <div className="flex flex-wrap justify-between text-sm text-green-600">
                              <div className="flex flex-wrap items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-green-500"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span>Korting ({appliedDiscount.code})</span>
                              </div>
                              <span>-€{calculateDiscount().toFixed(2)}</span>
                            </div>
                          )}
                          {calculateBundleDiscount() > 0 && (
                            <div className="flex flex-wrap justify-between text-sm text-green-600">
                              <span>Bundle korting</span>
                              <span>-€{calculateBundleDiscount().toFixed(2)}</span>
                            </div>
                          )}
                          {FeatureFlags.ENABLE_VOLUME_DISCOUNT && subtotal >= 75 && (
                            <div className="flex flex-wrap justify-between text-sm text-purple-600">
                              <span>Volume korting (10%)</span>
                              <span>
                                -€{calculateVolumeDiscount().toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="border-t pt-2 flex justify-between font-semibold">
                            <div className="flex flex-wrap items-center gap-2">
                              <svg
                                className="w-4 h-4 text-[#d7aa43]"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>Totaal</span>
                            </div>
                            <span>€{calculateTotal().toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Loyalty Points Info */}
                        {isLoggedIn && user?.loyalty && (
                          <div className="mt-4">
                            <CheckoutLoyaltyInfo
                              orderTotal={subtotal}
                              onCouponSelect={(couponCode) => {
                                // Apply the discount directly with the redeemed coupon code
                                applyDiscountCode(couponCode);
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Mobile Order Summary */}
                      <div
                        id="mobile-order-summary"
                        className="bg-white rounded-lg p-6 shadow-sm lg:hidden hidden"
                      >
                        <div className="space-y-4 mb-6">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="border border-gray-200 rounded-lg p-3"
                            >
                              <div className="flex flex-wrap gap-3">
                                <div className="relative flex-shrink-0">
                                  <Image
                                    src={item.image}
                                    alt={item.title || 'Product image'}
                                    width={60}
                                    height={60}
                                    className="object-cover rounded"
                                  />
                                </div>
                                <div className="flex-1">
                                  <div className="flex flex-wrap justify-between items-start mb-2">
                                    <div>
                                      <h3 className="text-sm font-medium">
                                        {item.title}
                                      </h3>
                                      {item.variant && (
                                        <p className="text-xs text-gray-500">
                                          {item.variant}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() =>
                                        removeFromCart(item.id, item.variant)
                                      }
                                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                      title="Product verwijderen"
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
                                          strokeWidth={2}
                                          d="M6 18L18 6M6 6l12 12"
                                        />
                                      </svg>
                                    </button>
                                  </div>

                                  {/* Quantity Controls */}
                                  <div className="flex flex-wrap items-center justify-between">
                                    <div className="flex flex-wrap items-center border border-gray-300 rounded">
                                      <button
                                        onClick={() =>
                                          updateQuantity(
                                            item.id,
                                            item.variant,
                                            Math.max(1, item.quantity - 1)
                                          )
                                        }
                                        className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                                        disabled={item.quantity <= 1}
                                      >
                                        <svg
                                          className="w-3 h-3"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M20 12H4"
                                          />
                                        </svg>
                                      </button>
                                      <span className="px-3 py-1 text-sm font-medium border-x border-gray-300 min-w-[40px] text-center">
                                        {item.quantity}
                                      </span>
                                      <button
                                        onClick={() =>
                                          updateQuantity(
                                            item.id,
                                            item.variant,
                                            item.quantity + 1
                                          )
                                        }
                                        className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                                      >
                                        <svg
                                          className="w-3 h-3"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 4v16m8-8H4"
                                          />
                                        </svg>
                                      </button>
                                    </div>
                                    <div className="text-sm font-medium">
                                      <span className="text-gray-500">
                                        {new Intl.NumberFormat("nl-NL", {
                                          style: "currency",
                                          currency: "EUR",
                                        }).format(
                                          (typeof item.price === "number"
                                            ? item.price
                                            : Number(
                                                String(
                                                  item.price ?? ""
                                                ).replace(",", ".")
                                              )) || 0
                                        )}{" "}
                                        × {item.quantity ?? 0} ={" "}
                                        {new Intl.NumberFormat("nl-NL", {
                                          style: "currency",
                                          currency: "EUR",
                                        }).format(
                                          ((typeof item.price === "number"
                                            ? item.price
                                            : Number(
                                                String(
                                                  item.price ?? ""
                                                ).replace(",", ".")
                                              )) || 0) * (item.quantity ?? 0)
                                        )}
                                      </span>
                                      <span className="text-[#d7aa43] font-semibold">
                                        €
                                        {(item.price * item.quantity).toFixed(
                                          2
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Selected Address Display - Mobile */}
                        {(formData.billingAddress ||
                          formData.selectedAddressId ||
                          (formData.useShippingAddress &&
                            formData.shippingAddress)) && (
                          <div className="border-t pt-4 mb-4">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <svg
                                className="w-4 h-4 text-[#d7aa43]"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <h3 className="text-sm font-semibold text-gray-900">
                                Bezorgadres
                              </h3>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              {(() => {
                                // Show shipping address if "Verzenden naar een ander adres" is selected and shipping address is filled
                                if (
                                  formData.useShippingAddress &&
                                  (formData.shippingAddress ||
                                    formData.shippingPostcode)
                                ) {
                                  return (
                                    <div>
                                      {(formData.firstName ||
                                        formData.lastName) && (
                                        <p className="font-medium text-gray-900">
                                          {formData.firstName}{" "}
                                          {formData.lastName}
                                        </p>
                                      )}
                                      {formData.shippingAddress ? (
                                        <>
                                          <p>
                                            {`${formData.shippingAddress} ${
                                              formData.shippingHouseNumber
                                            }${
                                              formData.shippingHouseAddition ||
                                              ""
                                            }`.trim()}
                                          </p>
                                          <p>
                                            {formData.shippingPostcode}{" "}
                                            {formData.shippingCity}
                                          </p>
                                          <p>
                                            {(() => {
                                              switch (
                                                formData.shippingCountry
                                              ) {
                                                case "NL":
                                                  return "Nederland";
                                                case "BE":
                                                  return "België";
                                                case "DE":
                                                  return "Duitsland";
                                                default:
                                                  return formData.shippingCountry;
                                              }
                                            })()}
                                          </p>
                                        </>
                                      ) : (
                                        <p className="text-gray-400 italic">
                                          Verzendadres nog niet ingevuld
                                        </p>
                                      )}
                                    </div>
                                  );
                                }

                                // Otherwise show billing address (default behavior)
                                const selectedAddress = previousAddresses.find(
                                  (addr) =>
                                    addr.id === formData.selectedAddressId
                                );

                                if (selectedAddress) {
                                  return (
                                    <div>
                                      <p className="font-medium text-gray-900">
                                        {selectedAddress.fullName}
                                      </p>
                                      <p>
                                        {formData.billingAddress &&
                                        formData.billingHouseNumber
                                          ? `${formData.billingAddress} ${
                                              formData.billingHouseNumber
                                            }${
                                              formData.billingHouseAddition ||
                                              ""
                                            }`.trim()
                                          : selectedAddress.street.replace(
                                              /\s+(\d+)\s+\1(?:\s|$)/,
                                              " $1"
                                            )}
                                      </p>
                                      <p>
                                        {selectedAddress.postalCode}{" "}
                                        {selectedAddress.city}
                                      </p>
                                      <p>
                                        {(() => {
                                          switch (selectedAddress.country) {
                                            case "NL":
                                              return "Nederland";
                                            case "BE":
                                              return "België";
                                            case "DE":
                                              return "Duitsland";
                                            default:
                                              return selectedAddress.country;
                                          }
                                        })()}
                                      </p>
                                    </div>
                                  );
                                } else if (formData.billingAddress) {
                                  // Fallback to manual address
                                  return (
                                    <div>
                                      {(formData.firstName ||
                                        formData.lastName) && (
                                        <p className="font-medium text-gray-900">
                                          {formData.firstName}{" "}
                                          {formData.lastName}
                                        </p>
                                      )}
                                      <p>
                                        {`${formData.billingAddress} ${
                                          formData.billingHouseNumber
                                        }${
                                          formData.billingHouseAddition || ""
                                        }`.trim()}
                                      </p>
                                      <p>
                                        {formData.billingPostcode}{" "}
                                        {formData.billingCity}
                                      </p>
                                      <p>
                                        {formData.billingCountry === "NL"
                                          ? "Nederland"
                                          : formData.billingCountry}
                                      </p>
                                    </div>
                                  );
                                }
                                return (
                                  <p className="text-gray-400 italic">
                                    Nog geen adres geselecteerd
                                  </p>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        <div className="border-t pt-4 space-y-2">
                          <div className="flex flex-wrap justify-between text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <svg
                                className="w-4 h-4 text-gray-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>Subtotaal</span>
                            </div>
                            <span>€{subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex flex-wrap justify-between text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <svg
                                className="w-4 h-4 text-gray-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-.293-.707L15 4.586A1 1 0 0014.414 4H14v3z" />
                              </svg>
                              <span>Verzending</span>
                            </div>
                            <span>
                              {calculateShipping() === 0
                                ? "Gratis"
                                : `€${calculateShipping().toFixed(2)}`}
                            </span>
                          </div>
                          {appliedDiscount && (
                            <div className="flex flex-wrap justify-between text-sm text-green-600">
                              <div className="flex flex-wrap items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-green-500"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span>Korting ({appliedDiscount.code})</span>
                              </div>
                              <span>-€{calculateDiscount().toFixed(2)}</span>
                            </div>
                          )}
                          {FeatureFlags.ENABLE_VOLUME_DISCOUNT && subtotal >= 75 && (
                            <div className="flex flex-wrap justify-between text-sm text-purple-600">
                              <span>Volume korting (10%)</span>
                              <span>
                                -€{calculateVolumeDiscount().toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="border-t pt-2 flex flex-wrap justify-between font-semibold">
                            <div className="flex flex-wrap items-center gap-2">
                              <svg
                                className="w-4 h-4 text-[#d7aa43]"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span>Totaal</span>
                            </div>
                            <span>€{calculateTotal().toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Loyalty Points Info - Mobile */}
                        {isLoggedIn && user?.loyalty && (
                          <div className="mt-4">
                            <CheckoutLoyaltyInfo
                              orderTotal={subtotal}
                              onCouponSelect={(couponCode) => {
                                // Apply the discount directly with the redeemed coupon code
                                applyDiscountCode(couponCode);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Next Step Button */}
                    <div className="bg-white rounded-lg p-6 shadow-sm">
                      <button
                        type="button"
                        onClick={() => {
                          // Validate email before proceeding
                          if (!formData.email) {
                            setError("E-mailadres is verplicht");
                            setEmailError("E-mailadres is verplicht");
                            // Scroll to the email field
                            const emailField = document.getElementById("email");
                            if (emailField) {
                              emailField.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                              emailField.focus();
                            }
                            return;
                          }

                          const emailValidation = validateEmail(formData.email);
                          if (!emailValidation.isValid) {
                            setError(
                              emailValidation.error ||
                                "Voer een geldig e-mailadres in"
                            );
                            setEmailError(
                              emailValidation.error ||
                                "Voer een geldig e-mailadres in"
                            );
                            // Scroll to the email field
                            const emailField = document.getElementById("email");
                            if (emailField) {
                              emailField.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                              emailField.focus();
                            }
                            return;
                          }

                          // Validate phone before proceeding
                          if (!formData.phone) {
                            setError("Telefoonnummer is verplicht");
                            setPhoneError("Telefoonnummer is verplicht");
                            // Scroll to the phone field
                            const phoneField = document.getElementById("phone");
                            if (phoneField) {
                              phoneField.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                              phoneField.focus();
                            }
                            return;
                          }

                          const phoneValidation = validatePhone(formData.phone);
                          if (!phoneValidation.isValid) {
                            setError(
                              phoneValidation.error ||
                                "Voer een geldig telefoonnummer in"
                            );
                            setPhoneError(
                              phoneValidation.error ||
                                "Voer een geldig telefoonnummer in"
                            );
                            // Scroll to the phone field
                            const phoneField = document.getElementById("phone");
                            if (phoneField) {
                              phoneField.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              });
                              phoneField.focus();
                            }
                            return;
                          }

                          setError(null);
                          setCurrentStep(2);
                        }}
                        // disabled={
                        //   !formData.firstName ||
                        //   !formData.lastName ||
                        //   !formData.email ||
                        //   (!formData.billingAddress &&
                        //     !formData.selectedAddressId)
                        // }
                        disabled={isNextButtonDisabled()}
                        className="w-full bg-gradient-to-br from-[#d7aa43] via-[#e8b960] to-[#c29635] md:bg-gradient-to-r md:from-[#d7aa43] md:to-[#e8b960] text-white py-4 px-8 rounded-xl font-bold text-lg tracking-wide hover:shadow-2xl hover:shadow-[#d7aa43]/50 hover:scale-[1.02] hover:from-[#e8b960] hover:via-[#d7aa43] hover:to-[#b88a2e] disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-500 shadow-xl shadow-[#d7aa43]/30 uppercase border-2 border-[#f5d68a]/20 hover:border-[#f5d68a]/40 disabled:shadow-none disabled:border-none"
                        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                      >
                        {currentStep === 1
                          ? "Verder naar betaling"
                          : "Verder naar overzicht"}
                      </button>
                      
                      {/* Validation Error Message - Shows missing fields */}
                      {isNextButtonDisabled() && getMissingFields().length > 0 && (
                        <div className="mt-4 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
                          <div className="flex items-start gap-3">
                            <svg 
                              className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" 
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path 
                                fillRule="evenodd" 
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" 
                                clipRule="evenodd" 
                              />
                            </svg>
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-amber-800 mb-1">
                                Vul de verplichte velden in om verder te gaan
                              </h3>
                              <p className="text-sm text-amber-700 mb-2">
                                De volgende velden zijn nog niet ingevuld:
                              </p>
                              <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                                {getMissingFields().map((field, index) => (
                                  <li key={index}>{field}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* General Error Message */}
                      {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-600">{error}</p>
                        </div>
                      )}
                    </div>
                  </form>
                )}

                {/* Step 2: Payment Page */}
                {currentStep === 2 && (
                  <div className="space-y-6" id="">
                    {/* Header */}
                    <div className="bg-white rounded-lg p-6 shadow-sm">
                      <h1 className="text-2xl font-bold text-gray-900 mb-2">
                        OVERZICHT.
                      </h1>
                      <p className="text-gray-600">Totaalplaatje.</p>
                    </div>

                    {/* Kloppen je gegevens */}
                    <div className="bg-white rounded-lg p-6 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">
                          Kloppen je gegevens?
                        </h2>
                        <button
                          onClick={() => setCurrentStep(1)}
                          className="text-[#0071CE] hover:underline text-sm flex items-center gap-1"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                          </svg>
                          Wijzig gegevens
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        <div>
                          <h3 className="font-medium text-gray-900">
                            Hier gaan we bezorgen
                          </h3>
                          <div className="mt-1 text-sm text-gray-600">
                            {(() => {
                              // Show shipping address if selected, otherwise billing address
                              if (
                                formData.useShippingAddress &&
                                formData.shippingAddress
                              ) {
                                return (
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {formData.firstName} {formData.lastName}
                                    </p>
                                    <p>
                                      {`${formData.shippingAddress} ${
                                        formData.shippingHouseNumber
                                      }${
                                        formData.shippingHouseAddition || ""
                                      }`.trim()}
                                    </p>
                                    <p>
                                      {formData.shippingPostcode}{" "}
                                      {formData.shippingCity}
                                    </p>
                                    <p>
                                      {(() => {
                                        switch (formData.shippingCountry) {
                                          case "NL":
                                            return "Nederland";
                                          case "BE":
                                            return "België";
                                          case "DE":
                                            return "Duitsland";
                                          default:
                                            return formData.shippingCountry;
                                        }
                                      })()}
                                    </p>
                                  </div>
                                );
                              } else {
                                const selectedAddress = previousAddresses.find(
                                  (addr) =>
                                    addr.id === formData.selectedAddressId
                                );
                                if (selectedAddress) {
                                  return (
                                    <div>
                                      <p className="font-medium text-gray-900">
                                        {selectedAddress.fullName}
                                      </p>
                                      <p>
                                        {formData.billingAddress &&
                                        formData.billingHouseNumber
                                          ? `${formData.billingAddress} ${
                                              formData.billingHouseNumber
                                            }${
                                              formData.billingHouseAddition ||
                                              ""
                                            }`.trim()
                                          : selectedAddress.street.replace(
                                              /\s+(\d+)\s+\1(?:\s|$)/,
                                              " $1"
                                            )}
                                      </p>
                                      <p>
                                        {selectedAddress.postalCode}{" "}
                                        {selectedAddress.city}
                                      </p>
                                      <p>
                                        {(() => {
                                          switch (selectedAddress.country) {
                                            case "NL":
                                              return "Nederland";
                                            case "BE":
                                              return "België";
                                            case "DE":
                                              return "Duitsland";
                                            default:
                                              return selectedAddress.country;
                                          }
                                        })()}
                                      </p>
                                    </div>
                                  );
                                } else if (formData.billingAddress) {
                                  return (
                                    <div>
                                      <p className="font-medium text-gray-900">
                                        {formData.firstName} {formData.lastName}{" "}
                                      </p>
                                      <p>
                                        {`${formData.billingAddress} ${formData.billingHouseNumber || ""}${
                                          formData.billingHouseAddition || ""
                                        }`.trim()}{" "}
                                      </p>
                                      <p>
                                        {formData.billingPostcode}{" "}
                                        {formData.billingCity}
                                      </p>
                                      <p>
                                        {formData.billingCountry === "NL"
                                          ? "Nederland"
                                          : formData.billingCountry}
                                      </p>
                                    </div>
                                  );
                                }
                                return (
                                  <p className="text-gray-400 italic">
                                    Geen adres geselecteerd
                                  </p>
                                );
                              }
                            })()}
                          </div>
                        </div>

                        <div>
                          <h3 className="font-medium text-gray-900">
                            Contactgegevens
                          </h3>
                          <div className="mt-1 text-sm text-gray-600">
                            <p>{formData.email}</p>
                            <p>{formData.phone}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bezorging */}
                    <div className="bg-white rounded-lg p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-gray-900">
                          Bezorging
                        </h2>
                        <button
                          type="button"
                          onClick={() => setShowDeliveryInfoPopup(true)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer group"
                          aria-label="Bezorginformatie"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span className="text-sm font-medium group-hover:underline">
                            Meer informatie
                          </span>
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">
                        We doen ons best om uw bestelling morgen te bezorgen.
                      </p>
                    </div>

                    {/* Last Chance - Frequently Bought Together */}
                    <div className="bg-amber-50 rounded-lg p-4 shadow-sm border border-amber-200">
                      <button
                        type="button"
                        onClick={() => setIsLastChanceSectionOpen(!isLastChanceSectionOpen)}
                        className="w-full flex items-center justify-between gap-2 mb-2 hover:opacity-70 transition-opacity"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xl">⚡</span>
                          <h2 className="text-sm font-semibold text-gray-900">
                            Laatste kans - Vaak samen gekocht
                          </h2>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-700 transition-transform duration-200 flex-shrink-0 ${
                            isLastChanceSectionOpen ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {isLastChanceSectionOpen && (
                        <div className="space-y-2 animate-in fade-in duration-200">
                        {isLoadingProducts
                          ? // Loading skeleton for overview
                            Array.from({ length: 2 }).map((_, index) => (
                              <div
                                key={`overview-loading-${index}`}
                                className="bg-white rounded-lg p-2 border border-amber-200 animate-pulse"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="w-12 h-12 bg-amber-100 rounded-lg"></div>
                                  <div className="flex-1">
                                    <div className="h-3 bg-gray-200 rounded mb-1"></div>
                                    <div className="h-2 bg-gray-200 rounded mb-1"></div>
                                    <div className="h-2 bg-gray-200 rounded w-16"></div>
                                  </div>
                                  <div className="w-16 h-7 bg-gray-200 rounded-lg"></div>
                                </div>
                              </div>
                            ))
                          : suggestedProducts.slice(0, 2).map((product) => (
                              <div
                                key={`overview-${product.id}`}
                                className="bg-white rounded-lg p-2 border border-amber-200 hover:border-amber-300 transition-colors"
                              >
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    <img
                                      src={product.image}
                                      alt={product.title}
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target =
                                          e.target as HTMLImageElement;
                                        target.style.display = "none";
                                        const parent = target.parentElement;
                                        if (parent) {
                                          parent.innerHTML =
                                            '<span class="text-2xl">📦</span>';
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-1">
                                      <h4 className="text-sm font-semibold text-gray-900">
                                        {product.title}
                                      </h4>
                                      {isLoggedIn && (
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                                          Nieuw voor jou!
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                      <span className="text-xs font-bold text-[#d7aa43]">
                                        €{product.price.toFixed(2)}
                                      </span>
                                      {product.badge && (
                                        <span
                                          className={`text-[10px] px-1.5 py-0.5 rounded-full text-white ${
                                            product.badge.includes("Nieuw")
                                              ? "bg-blue-500"
                                              : product.badge.includes(
                                                  "Bestseller"
                                                ) ||
                                                product.badge.includes("#1")
                                              ? "bg-orange-500"
                                              : product.badge.includes(
                                                  "Premium"
                                                )
                                              ? "bg-purple-500"
                                              : "bg-green-500"
                                          }`}
                                        >
                                          {product.badge}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {product.inCart ? (
                                    <div className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-lg border border-green-300 flex items-center gap-1">
                                      <svg
                                        className="w-3 h-3"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      Toegevoegd
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        addToCartWithRotation({
                                          id: product.id,
                                          title: product.title,
                                          price: product.price,
                                          image: product.image,
                                        });
                                      }}
                                      className="px-3 py-1.5 bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] text-white text-xs font-semibold rounded-lg hover:shadow-lg hover:shadow-[#d7aa43]/40 hover:scale-105 hover:from-[#e8b960] hover:to-[#d7aa43] transition-all duration-300 shadow-md border border-[#f5d68a]/30 hover:border-[#f5d68a]/50"
                                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                                    >
                                      Toevoegen
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}

                        {/* Show fallback message if no products */}
                        {!isLoadingProducts &&
                          suggestedProducts.length === 0 && (
                            <div className="text-center py-3 text-gray-500">
                              <p className="text-xs">
                                {isLoggedIn
                                  ? "Geweldig! Je hebt al onze top producten in je collectie 🌟"
                                  : "Ontdek meer geweldige producten in onze shop"}
                              </p>
                              <button
                                onClick={openProductsPopup}
                                className="inline-block mt-1 text-[#d7aa43] underline hover:no-underline text-xs cursor-pointer"
                              >
                                Bekijk alle producten →
                              </button>
                            </div>
                          )}

                        {/* Tip section */}
                        {suggestedProducts.length > 0 && (
                          <div className="mt-2 p-2 bg-amber-100 rounded-lg">
                            <p className="text-[10px] text-amber-800 text-center">
                              💡 <strong>Tip:</strong>{" "}
                              {isLoggedIn
                                ? "Deze producten zijn speciaal geselecteerd omdat je ze nog niet hebt geprobeerd!"
                                : "Klanten die deze producten erbij kochten, rapporteren 40% betere wasresultaten!"}
                            </p>
                          </div>
                        )}
                      </div>
                      )}
                    </div>

                    {/* Kies een betaalmethode */}
                    <div className="bg-white rounded-lg md:p-6 p-2 shadow-sm">
                      {/* <h2 className="text-lg font-semibold text-gray-900 mb-4">
                        Kies een betaalmethode
                      </h2> */}

                      {/* Discount Code Section */}
                      {/* <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                        <h3 className="text-sm font-medium text-gray-900 mb-3">
                          Kortingscode gebruiken
                        </h3>

                        {!appliedDiscount ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              <input
                                type="text"
                                value={discountCode}
                                onChange={(e) =>
                                  setDiscountCode(e.target.value)
                                }
                                placeholder="Voer kortingscode in"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                onKeyPress={(e) =>
                                  e.key === "Enter" && applyDiscountCode()
                                }
                              />
                              <button
                                type="button"
                                onClick={applyDiscountCode}
                                disabled={
                                  isApplyingDiscount || !discountCode.trim()
                                }
                                className="px-4 py-2 bg-[#0071CE] text-white rounded-lg hover:bg-[#0063B8] disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium">
                                {isApplyingDiscount
                                  ? "Toepassen..."
                                  : "Toepassen"}
                              </button>
                            </div>

                            {discountError && (
                              <div className="mt-2 text-sm text-red-600">
                                {discountError}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                            <div>
                              <p className="text-sm font-medium text-green-800">
                                Kortingscode "{appliedDiscount.code}" toegepast
                              </p>
                              <p className="text-xs text-green-600">
                                {appliedDiscount.type === "percentage"
                                  ? `${appliedDiscount.amount}% korting`
                                  : `€${appliedDiscount.amount.toFixed(
                                      2
                                    )} korting`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={removeDiscount}
                              className="text-red-600 hover:text-red-800 text-sm">
                              Verwijderen
                            </button>
                          </div>
                        )}
                      </div> */}
                      <details className="group mb-6 rounded-lg border border-gray-200 bg-gray-50">
                        <summary className="flex cursor-pointer list-none items-center justify-between p-4">
                          <h3 className="text-base font-semibold text-gray-900">
                            Kortingscode | Punten
                          </h3>
                          {/* Chevron */}
                          <svg
                            className="h-4 w-4 transition-transform group-open:rotate-180"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            aria-hidden="true"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </summary>

                        <div className="px-4 pb-4 pt-0">
                          {!appliedDiscount ? (
                            <>
                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="text"
                                  value={discountCode}
                                  onChange={(e) =>
                                    setDiscountCode(e.target.value)
                                  }
                                  placeholder="Voer kortingscode in"
                                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#d7aa43]"
                                  onKeyDown={(e) =>
                                    e.key === "Enter" && applyDiscountCode()
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() => applyDiscountCode()}
                                  disabled={
                                    isApplyingDiscount || !discountCode.trim()
                                  }
                                  className="rounded-xl bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] px-4 py-2 text-sm font-bold text-white hover:shadow-xl hover:shadow-[#d7aa43]/40 hover:scale-105 hover:from-[#e8b960] hover:to-[#d7aa43] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:opacity-50 transition-all duration-400 shadow-lg shadow-[#d7aa43]/30 tracking-wide border border-[#f5d68a]/30 hover:border-[#f5d68a]/50 disabled:shadow-none disabled:border-none"
                                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                                >
                                  {isApplyingDiscount
                                    ? "Toepassen..."
                                    : "Toepassen"}
                                </button>
                              </div>

                              {discountError && (
                                <div className="mt-2 text-sm text-red-600">
                                  {discountError}
                                </div>
                              )}
                              <button
                                onClick={handleOpenRedemptionPopup}
                                className="mt-5 rounded-xl bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] px-5 py-2.5 text-sm font-bold text-white hover:shadow-xl hover:shadow-[#d7aa43]/40 hover:scale-105 hover:from-[#e8b960] hover:to-[#d7aa43] disabled:cursor-not-allowed disabled:bg-gray-300 disabled:opacity-50 transition-all duration-400 shadow-lg shadow-[#d7aa43]/30 tracking-wide border border-[#f5d68a]/30 hover:border-[#f5d68a]/50 disabled:shadow-none disabled:border-none"
                                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                              >
                                Beheer punten →
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3">
                              <div>
                                <p className="text-sm font-medium text-green-800">
                                  Kortingscode "{appliedDiscount.code}"
                                  toegepast
                                </p>
                                <p className="text-xs text-green-600">
                                  {appliedDiscount.type === "percentage"
                                    ? `${appliedDiscount.amount}% korting`
                                    : `€${appliedDiscount.amount.toFixed(
                                        2
                                      )} korting`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={removeDiscount}
                                className="text-sm text-red-600 hover:text-red-800"
                              >
                                Verwijderen
                              </button>
                            </div>
                          )}
                        </div>
                      </details>

                      {/* Payment Methods */}
                      <PaymentPage
                        orderData={memoizedOrderData}
                        onError={(error) => {
                          // Handle payment error
                          console.error("Payment error:", error);
                          setError(error);
                        }}
                        orderSummary={{
                          items,
                          subtotal,
                          appliedDiscount,
                          calculateShipping,
                          calculateDiscount,
                          calculateVolumeDiscount,
                          calculateTotal,
                          removeFromCart,
                          updateQuantity,
                          formData,
                          previousAddresses,
                          isLoggedIn,
                          user: user || undefined,
                          // ✅ Loyalty callback stays in Checkout (where the state lives)
                          onLoyaltyCouponSelect: async (couponCode: string) => {
                            setIsApplyingDiscount(true);
                            setDiscountError("");
                            try {
                              const response = await fetch(
                                `/api/woocommerce/coupons/validate`,
                                {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    coupon_code: couponCode,
                                    subtotal,
                                  }),
                                }
                              );
                              if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(
                                  errorData.message || "Ongeldige kortingscode"
                                );
                              }
                              const couponData = await response.json();
                              setAppliedDiscount({
                                code: couponCode,
                                amount: couponData.discount_amount,
                                type:
                                  couponData.discount_type === "percent"
                                    ? "percentage"
                                    : "fixed",
                              });
                              setDiscountCode("");
                            } catch (err) {
                              setDiscountError(
                                err instanceof Error
                                  ? err.message
                                  : "Kortingscode kon niet worden toegepast"
                              );
                              setAppliedDiscount(null);
                            } finally {
                              setIsApplyingDiscount(false);
                            }
                          },
                        }}
                        // onError={(err) => {
                        //   console.error("Payment error:", err);
                        //   setError(err);
                        // }}
                      />

                      {/* Error Display */}
                      {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-600">{error}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Order Summary Sidebar */}
              <div className="lg:col-span-1 sm:hidden md:block">
                <div
                  id="order-summary"
                  className="bg-white rounded-xl shadow-lg sticky top-4 hidden lg:block overflow-hidden border border-gray-100"
                >
                  {/* Premium Header */}
                  <div className="bg-gradient-to-br from-slate-50 to-gray-100 px-6 py-5 border-b-2 border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg
                            className="w-6 h-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                            Orderoverzicht
                          </h2>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600 font-medium">
                              {items.length} {items.length === 1 ? 'product' : 'producten'}
                            </span>
                            <span className="text-gray-300">•</span>
                            <div className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                              <span className="text-xs text-green-600 font-semibold">
                                Beveiligd
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Free Shipping Progress Bar */}
                  {subtotal < 40 && (
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 px-6 py-4 border-b border-blue-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900">
                          🚚 Nog €{(40 - subtotal).toFixed(2)} voor gratis verzending!
                        </span>
                      </div>
                      <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min((subtotal / 40) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {subtotal >= 40 && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-6 py-3 border-b border-green-100">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm font-semibold text-green-800">
                          Gefeliciteerd! Je krijgt gratis verzending 🎉
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Products Section */}
                  <div className="px-6 py-5 max-h-[400px] overflow-y-auto"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#d7aa43 #f3f4f6'
                    }}
                  >

                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="group relative bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-300 hover:border-[#d7aa43]/30"
                      >
                        <div className="flex gap-4">
                          <div className="relative flex-shrink-0">
                            <div className="w-20 h-20 rounded-lg overflow-hidden bg-white shadow-sm border border-gray-100">
                              <Image
                                src={item.image}
                                alt={item.title || 'Product image'}
                                width={80}
                                height={80}
                                className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                            <div className="absolute -top-2 -right-2 bg-gradient-to-br from-[#e8b960] via-[#d7aa43] to-[#c29635] text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg shadow-[#d7aa43]/50 border-2 border-white ring-2 ring-[#f5d68a]/30"
                              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                            >
                              {item.quantity}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex-1 min-w-0 pr-2">
                                <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
                                  {item.title}
                                </h3>
                                {item.variant && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {item.variant}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  removeFromCart(item.id, item.variant)
                                }
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="Product verwijderen"
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
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>

                            {/* Price and Quantity */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                              <div className="flex flex-col">
                                <span className="text-xs text-gray-500">
                                  €{item.price.toFixed(2)} per stuk
                                </span>
                                <span className="text-lg font-bold text-[#d7aa43] mt-0.5">
                                  €{(item.price * item.quantity).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.variant,
                                      Math.max(1, item.quantity - 1)
                                    )
                                  }
                                  className="px-2.5 py-1.5 text-gray-600 hover:text-[#d7aa43] hover:bg-amber-50 transition-colors rounded-l-md disabled:opacity-30 disabled:cursor-not-allowed"
                                  disabled={item.quantity <= 1}
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2.5}
                                      d="M20 12H4"
                                    />
                                  </svg>
                                </button>
                                <span className="px-3 text-sm font-bold text-gray-900 min-w-[24px] text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.variant,
                                      item.quantity + 1
                                    )
                                  }
                                  className="px-2.5 py-1.5 text-gray-600 hover:text-[#d7aa43] hover:bg-amber-50 transition-colors rounded-r-md"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2.5}
                                      d="M12 4v16m8-8H4"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  </div>

                  {/* Selected Address Display */}
                  {(formData.billingAddress ||
                    formData.selectedAddressId ||
                    (formData.useShippingAddress &&
                      formData.shippingAddress)) && (
                    <div className="px-6 py-4 bg-gradient-to-br from-blue-50 to-cyan-50 border-y border-blue-100">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">
                            Bezorgadres
                          </h3>
                          <p className="text-xs text-blue-600">Levering binnen 1-2 werkdagen</p>
                        </div>
                      </div>
                      <div className="text-sm text-gray-700 space-y-1 bg-white/70 backdrop-blur-sm rounded-lg p-3 border border-blue-200/50">
                        {(() => {
                          // Show shipping address if "Verzenden naar een ander adres" is selected and shipping address is filled
                          if (
                            formData.useShippingAddress &&
                            (formData.shippingAddress ||
                              formData.shippingPostcode)
                          ) {
                            return (
                              <div>
                                {(formData.firstName || formData.lastName) && (
                                  <p className="font-medium text-gray-900">
                                    {formData.firstName} {formData.lastName}
                                  </p>
                                )}
                                {formData.shippingAddress ? (
                                  <>
                                    <p>
                                      {`${formData.shippingAddress} ${
                                        formData.shippingHouseNumber
                                      }${
                                        formData.shippingHouseAddition || ""
                                      }`.trim()}
                                    </p>
                                    <p>
                                      {formData.shippingPostcode}{" "}
                                      {formData.shippingCity}
                                    </p>
                                    <p>
                                      {(() => {
                                        switch (formData.shippingCountry) {
                                          case "NL":
                                            return "Nederland";
                                          case "BE":
                                            return "België";
                                          case "DE":
                                            return "Duitsland";
                                          default:
                                            return formData.shippingCountry;
                                        }
                                      })()}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-gray-400 italic">
                                    Verzendadres nog niet ingevuld
                                  </p>
                                )}
                              </div>
                            );
                          }

                          // Otherwise show billing address (default behavior)
                          const selectedAddress = previousAddresses.find(
                            (addr) => addr.id === formData.selectedAddressId
                          );

                          if (selectedAddress) {
                            return (
                              <div>
                                <p className="font-medium text-gray-900">
                                  {selectedAddress.fullName}
                                </p>
                                <p>
                                  {formData.billingAddress &&
                                  formData.billingHouseNumber
                                    ? `${formData.billingAddress} ${
                                        formData.billingHouseNumber
                                      }${
                                        formData.billingHouseAddition || ""
                                      }`.trim()
                                    : selectedAddress.street.replace(
                                        /\s+(\d+)\s+\1(?:\s|$)/,
                                        " $1"
                                      )}
                                </p>
                                <p>
                                  {selectedAddress.postalCode}{" "}
                                  {selectedAddress.city}
                                </p>
                                <p>
                                  {(() => {
                                    switch (selectedAddress.country) {
                                      case "NL":
                                        return "Nederland";
                                      case "BE":
                                        return "België";
                                      case "DE":
                                        return "Duitsland";
                                      default:
                                        return selectedAddress.country;
                                    }
                                  })()}
                                </p>
                              </div>
                            );
                          } else if (formData.billingAddress) {
                            // Fallback to manual address
                            return (
                              <div>
                                {(formData.firstName || formData.lastName) && (
                                  <p className="font-medium text-gray-900">
                                    {formData.firstName} {formData.lastName}
                                  </p>
                                )}
                                <p>
                                  {`${formData.billingAddress} ${
                                    formData.billingHouseNumber
                                  }${
                                    formData.billingHouseAddition || ""
                                  }`.trim()}
                                </p>
                                <p>
                                  {formData.billingPostcode}{" "}
                                  {formData.billingCity}
                                </p>
                                <p>
                                  {formData.billingCountry === "NL"
                                    ? "Nederland"
                                    : formData.billingCountry}
                                </p>
                              </div>
                            );
                          }
                          return (
                            <p className="text-gray-400 italic">
                              Nog geen adres geselecteerd
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Totals Section */}
                  <div className="px-6 py-5 bg-gray-50 border-t border-gray-200">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600 font-medium">Subtotaal</span>
                        <span className="text-gray-900 font-semibold">€{subtotal.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                            <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-.293-.707L15 4.586A1 1 0 0014.414 4H14v3z" />
                          </svg>
                          <span className="text-gray-600 font-medium">Verzendkosten</span>
                        </div>
                        <span className={`font-semibold ${calculateShipping() === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                          {calculateShipping() === 0
                            ? "Gratis! 🎉"
                            : `€${calculateShipping().toFixed(2)}`}
                        </span>
                      </div>

                      {appliedDiscount && (
                        <div className="flex justify-between items-center py-2 px-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-green-800 font-medium">Korting ({appliedDiscount.code})</span>
                          </div>
                          <span className="text-sm text-green-700 font-bold">-€{calculateDiscount().toFixed(2)}</span>
                        </div>
                      )}

                      {FeatureFlags.ENABLE_VOLUME_DISCOUNT && subtotal >= 75 && (
                        <div className="flex justify-between items-center py-2 px-3 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-purple-800 font-medium">Volume korting (10%)</span>
                            <span className="text-xs bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full font-bold">DEAL</span>
                          </div>
                          <span className="text-sm text-purple-700 font-bold">-€{calculateVolumeDiscount().toFixed(2)}</span>
                        </div>
                      )}

                      {/* Savings Summary */}
                      {(appliedDiscount || (FeatureFlags.ENABLE_VOLUME_DISCOUNT && subtotal >= 75) || calculateShipping() === 0) && (
                        <div className="pt-2 border-t border-gray-200">
                          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                            <span className="text-base">💰</span>
                            <span className="font-semibold">
                              Je bespaart vandaag €
                              {(
                                (appliedDiscount ? calculateDiscount() : 0) +
                                (FeatureFlags.ENABLE_VOLUME_DISCOUNT && subtotal >= 75 ? calculateVolumeDiscount() : 0) +
                                (subtotal >= 40 ? 5.95 : 0)
                              ).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Grand Total */}
                    <div className="mt-4 pt-4 border-t-2 border-[#d7aa43]/20">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-gray-900">Totaal</span>
                          <span className="text-xs text-gray-500">(incl. BTW)</span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-black text-[#d7aa43]">
                            €{calculateTotal().toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Loyalty Points Info */}
                  {isLoggedIn && user?.loyalty && (
                    <div className="mt-4">
                      <CheckoutLoyaltyInfo
                        orderTotal={subtotal}
                        onCouponSelect={(couponCode) => {
                          // Apply the discount directly with the redeemed coupon code
                          applyDiscountCode(couponCode);
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Mobile Order Summary */}
                <div
                  id="mobile-order-summary"
                  className="bg-white rounded-lg p-6 shadow-sm lg:hidden hidden"
                >
                  <div className="space-y-4 mb-6">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex flex-wrap gap-3">
                          <div className="relative flex-shrink-0">
                            <Image
                              src={item.image}
                              alt={item.title || 'Product image'}
                              width={60}
                              height={60}
                              className="object-cover rounded"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap justify-between items-start mb-2">
                              <div>
                                <h3 className="text-sm font-medium">
                                  {item.title}
                                </h3>
                                {item.variant && (
                                  <p className="text-xs text-gray-500">
                                    {item.variant}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  removeFromCart(item.id, item.variant)
                                }
                                className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                title="Product verwijderen"
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
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex flex-wrap items-center justify-between">
                              <div className="flex flex-wrap items-center border border-gray-300 rounded">
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.variant,
                                      Math.max(1, item.quantity - 1)
                                    )
                                  }
                                  className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                                  disabled={item.quantity <= 1}
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M20 12H4"
                                    />
                                  </svg>
                                </button>
                                <span className="px-3 py-1 text-sm font-medium border-x border-gray-300 min-w-[40px] text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() =>
                                    updateQuantity(
                                      item.id,
                                      item.variant,
                                      item.quantity + 1
                                    )
                                  }
                                  className="px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                                >
                                  <svg
                                    className="w-3 h-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 4v16m8-8H4"
                                    />
                                  </svg>
                                </button>
                              </div>
                              <div className="text-sm font-medium">
                                <span className="text-gray-500">
                                  {new Intl.NumberFormat("nl-NL", {
                                    style: "currency",
                                    currency: "EUR",
                                  }).format(
                                    (typeof item.price === "number"
                                      ? item.price
                                      : Number(
                                          String(item.price ?? "").replace(
                                            ",",
                                            "."
                                          )
                                        )) || 0
                                  )}{" "}
                                  × {item.quantity ?? 0} ={" "}
                                  {new Intl.NumberFormat("nl-NL", {
                                    style: "currency",
                                    currency: "EUR",
                                  }).format(
                                    ((typeof item.price === "number"
                                      ? item.price
                                      : Number(
                                          String(item.price ?? "").replace(
                                            ",",
                                            "."
                                          )
                                        )) || 0) * (item.quantity ?? 0)
                                  )}
                                </span>
                                <span className="text-[#d7aa43] font-semibold">
                                  €{(item.price * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Selected Address Display - Mobile */}
                  {(formData.billingAddress ||
                    formData.selectedAddressId ||
                    (formData.useShippingAddress &&
                      formData.shippingAddress)) && (
                    <div className="border-t pt-4 mb-4">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <svg
                          className="w-4 h-4 text-[#d7aa43]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <h3 className="text-sm font-semibold text-gray-900">
                          Bezorgadres
                        </h3>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        {(() => {
                          // Show shipping address if "Verzenden naar een ander adres" is selected and shipping address is filled
                          if (
                            formData.useShippingAddress &&
                            (formData.shippingAddress ||
                              formData.shippingPostcode)
                          ) {
                            return (
                              <div>
                                {(formData.firstName || formData.lastName) && (
                                  <p className="font-medium text-gray-900">
                                    {formData.firstName} {formData.lastName}
                                  </p>
                                )}
                                {formData.shippingAddress ? (
                                  <>
                                    <p>
                                      {`${formData.shippingAddress} ${
                                        formData.shippingHouseNumber
                                      }${
                                        formData.shippingHouseAddition || ""
                                      }`.trim()}
                                    </p>
                                    <p>
                                      {formData.shippingPostcode}{" "}
                                      {formData.shippingCity}
                                    </p>
                                    <p>
                                      {(() => {
                                        switch (formData.shippingCountry) {
                                          case "NL":
                                            return "Nederland";
                                          case "BE":
                                            return "België";
                                          case "DE":
                                            return "Duitsland";
                                          default:
                                            return formData.shippingCountry;
                                        }
                                      })()}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-gray-400 italic">
                                    Verzendadres nog niet ingevuld
                                  </p>
                                )}
                              </div>
                            );
                          }

                          // Otherwise show billing address (default behavior)
                          const selectedAddress = previousAddresses.find(
                            (addr) => addr.id === formData.selectedAddressId
                          );

                          if (selectedAddress) {
                            return (
                              <div>
                                <p className="font-medium text-gray-900">
                                  {selectedAddress.fullName}
                                </p>
                                <p>
                                  {formData.billingAddress &&
                                  formData.billingHouseNumber
                                    ? `${formData.billingAddress} ${
                                        formData.billingHouseNumber
                                      }${
                                        formData.billingHouseAddition || ""
                                      }`.trim()
                                    : selectedAddress.street.replace(
                                        /\s+(\d+)\s+\1(?:\s|$)/,
                                        " $1"
                                      )}
                                </p>
                                <p>
                                  {selectedAddress.postalCode}{" "}
                                  {selectedAddress.city}
                                </p>
                                <p>
                                  {(() => {
                                    switch (selectedAddress.country) {
                                      case "NL":
                                        return "Nederland";
                                      case "BE":
                                        return "België";
                                      case "DE":
                                        return "Duitsland";
                                      default:
                                        return selectedAddress.country;
                                    }
                                  })()}
                                </p>
                              </div>
                            );
                          } else if (formData.billingAddress) {
                            // Fallback to manual address
                            return (
                              <div>
                                {(formData.firstName || formData.lastName) && (
                                  <p className="font-medium text-gray-900">
                                    {formData.firstName} {formData.lastName}
                                  </p>
                                )}
                                <p>
                                  {`${formData.billingAddress} ${
                                    formData.billingHouseNumber
                                  }${
                                    formData.billingHouseAddition || ""
                                  }`.trim()}
                                </p>
                                <p>
                                  {formData.billingPostcode}{" "}
                                  {formData.billingCity}
                                </p>
                                <p>
                                  {formData.billingCountry === "NL"
                                    ? "Nederland"
                                    : formData.billingCountry}
                                </p>
                              </div>
                            );
                          }
                          return (
                            <p className="text-gray-400 italic">
                              Nog geen adres geselecteerd
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex flex-wrap justify-between text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <svg
                          className="w-4 h-4 text-gray-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Subtotaal</span>
                      </div>
                      <span>€{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-wrap justify-between text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <svg
                          className="w-4 h-4 text-gray-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                          <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1V8a1 1 0 00-.293-.707L15 4.586A1 1 0 0014.414 4H14v3z" />
                        </svg>
                        <span>Verzending</span>
                      </div>
                      <span>
                        {calculateShipping() === 0
                          ? "Gratis"
                          : `€${calculateShipping().toFixed(2)}`}
                      </span>
                    </div>
                    {appliedDiscount && (
                      <div className="flex flex-wrap justify-between text-sm text-green-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <svg
                            className="w-4 h-4 text-green-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
                              clipRule="evenodd"
                            />
                          </svg>
                          <span>Korting ({appliedDiscount.code})</span>
                        </div>
                        <span>-€{calculateDiscount().toFixed(2)}</span>
                      </div>
                    )}
                    {calculateBundleDiscount() > 0 && (
                      <div className="flex flex-wrap justify-between text-sm text-green-600">
                        <span>Bundle korting</span>
                        <span>-€{calculateBundleDiscount().toFixed(2)}</span>
                      </div>
                    )}
                    {FeatureFlags.ENABLE_VOLUME_DISCOUNT && subtotal >= 75 && (
                      <div className="flex flex-wrap justify-between text-sm text-purple-600">
                        <span>Volume korting (10%)</span>
                        <span>-€{calculateVolumeDiscount().toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex flex-wrap justify-between font-semibold">
                      <div className="flex flex-wrap items-center gap-2">
                        <svg
                          className="w-4 h-4 text-[#d7aa43]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Totaal</span>
                      </div>
                      <span>€{calculateTotal().toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Loyalty Points Info - Mobile */}
                  {isLoggedIn && user?.loyalty && (
                    <div className="mt-4">
                      <CheckoutLoyaltyInfo
                        orderTotal={subtotal}
                        onCouponSelect={(couponCode) => {
                          // Apply the discount directly with the redeemed coupon code
                          applyDiscountCode(couponCode);
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Money Back Guarantee */}
        <div className="hidden md:block bg-gradient-to-br from-[#d7aa43] via-[#e8b960] to-[#c29635] text-white py-12 mt-12 shadow-2xl border-t-4 border-[#f5d68a]/40 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
          <div className="relative z-10">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <h2 className="text-2xl font-bold mb-4">
                100% Tevredenheidsgarantie
              </h2>
              <p className="text-lg mb-6">
                Niet tevreden? Geen probleem! Je krijgt binnen 30 dagen je geld
                terug.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Geen gedoe</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Geen vragen</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>100% terugbetaling</span>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Customer Testimonials Section */}
        {/* <div className="bg-white py-12">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-semibold text-center mb-8">
              Wat klanten zeggen
            </h2>
            <h2 className="text-2xl font-semibold text-center mb-8">
              I m the duplicate testimonials header
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-[#F4F2EB] p-6 rounded-lg">
                <div className="flex flex-wrap mb-2">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 text-yellow-400 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  "Heerlijke geuren die lang blijven hangen. De verzending was
                  snel en het product was prachtig verpakt!"
                </p>
                <p className="text-sm font-medium">- Maria K.</p>
              </div>
              <div className="bg-[#F4F2EB] p-6 rounded-lg">
                <div className="flex flex-wrap mb-2">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 text-yellow-400 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  "Eindelijk een wasparfum dat niet te overheersend is. Perfect
                  voor mijn gevoelige huid!"
                </p>
                <p className="text-sm font-medium">- Jan V.</p>
              </div>
              <div className="bg-[#F4F2EB] p-6 rounded-lg">
                <div className="flex flex-wrap mb-2">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 text-yellow-400 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  "Geweldige service en snelle levering. Ik bestel hier zeker
                  weer!"
                </p>
                <p className="text-sm font-medium">- Sophie T.</p>
              </div>
            </div>
          </div>
        </div> */}
        <div className={currentStep === 2 ? "hidden md:block" : ""}>
          <TestimonialsSection />
        </div>

        {/* Products Popup */}
        {showProductsPopup && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-none sm:rounded-xl w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl overflow-hidden flex flex-col shadow-2xl">
              {/* Header - Sticky */}
              <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b bg-white sticky top-0 z-10 shrink-0">
                <div>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                    Alle producten
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                    Selecteer producten om toe te voegen
                  </p>
                </div>
                <button
                  onClick={() => setShowProductsPopup(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1 sm:p-2 transition-all ml-2 sm:ml-4"
                  aria-label="Sluiten"
                >
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>


              {/* Products Grid - Scrollable */}
              <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 overflow-y-auto flex-1 overscroll-contain">
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4"
                >
                  {allProducts.map((product) => (
                    <div
                      key={product.id}
                      className={`group relative w-full bg-white rounded-lg sm:rounded-xl p-2 sm:p-2.5 lg:p-3 border-2 cursor-pointer transition-all duration-200 hover:shadow-lg active:scale-[0.98] ${
                        selectedProducts.has(product.id)
                          ? "border-[#d7aa43] shadow-md ring-2 ring-[#d7aa43]/20"
                          : "border-gray-200 hover:border-[#d7aa43]/50"
                      }`}
                      onClick={() => toggleProductSelection(product.id)}
                    >
                      {/* Selection checkbox - Absolute positioned */}
                      <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10">
                        <div
                          className={`w-5 h-5 sm:w-6 sm:h-6 lg:w-5 lg:h-5 xl:w-6 xl:h-6 rounded-md sm:rounded-lg border-2 flex items-center justify-center transition-all shadow-sm ${
                            selectedProducts.has(product.id)
                              ? "bg-[#d7aa43] border-[#d7aa43] scale-110"
                              : "bg-white border-gray-300 group-hover:border-[#d7aa43]/50"
                          }`}
                        >
                          {selectedProducts.has(product.id) && (
                            <svg
                              className="w-3 h-3 sm:w-4 sm:h-4 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* In cart indicator - Absolute positioned */}
                      {product.in_cart && (
                        <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10">
                          <span className="text-[9px] sm:text-[10px] bg-green-500 text-white px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full font-medium shadow-sm flex items-center gap-0.5 sm:gap-1">
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                            </svg>
                            <span className="hidden md:inline text-[10px]">In cart</span>
                          </span>
                        </div>
                      )}

                      {/* Product image */}
                      <div className="w-full aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg mb-2 sm:mb-3 overflow-hidden flex items-center justify-center">
                        <img
                          src={product.image}
                          alt={product.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML =
                                '<span class="text-4xl">📦</span>';
                            }
                          }}
                        />
                      </div>

                      {/* Product info */}
                      <div className="space-y-1.5 sm:space-y-2">
                        {/* Badge */}
                        {product.badge && (
                          <span
                            className={`inline-block text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full text-white font-medium ${
                              product.badge.includes("Nieuw")
                                ? "bg-blue-500"
                                : product.badge.includes("Bestseller") ||
                                  product.badge.includes("#1")
                                ? "bg-orange-500"
                                : product.badge.includes("Premium")
                                ? "bg-purple-500"
                                : "bg-green-500"
                            }`}
                          >
                            {product.badge}
                          </span>
                        )}
                        
                        {/* Title */}
                        <h3 className="font-semibold text-gray-900 text-xs sm:text-sm lg:text-xs xl:text-sm line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem] lg:min-h-[2rem]">
                          {product.title}
                        </h3>

                        {/* Price and Quantity Row */}
                        <div className="flex items-center justify-between gap-1 sm:gap-2 pt-0.5 sm:pt-1">
                          <div>
                            <p className="text-base sm:text-lg lg:text-base xl:text-lg font-bold text-[#d7aa43]">
                              €{product.price.toFixed(2)}
                            </p>
                            {/* Total price for this product */}
                            {(product.quantity || 1) > 1 && (
                              <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium">
                                Totaal: €{((product.price || 0) * (product.quantity || 1)).toFixed(2)}
                              </p>
                            )}
                          </div>

                          {/* Quantity Controls - Compact for multiple columns */}
                          <div
                            className="flex items-center bg-gray-50 border border-gray-200 rounded-md sm:rounded-lg overflow-hidden shadow-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() =>
                                updatePopupQuantity(
                                  product.id,
                                  Math.max(1, (product.quantity || 1) - 1)
                                )
                              }
                              className="px-1.5 py-1.5 sm:px-2 lg:px-1.5 xl:px-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors active:bg-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                              disabled={(product.quantity || 1) <= 1}
                              aria-label="Verminderen"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M20 12H4"
                                />
                              </svg>
                            </button>
                            <span className="px-1.5 sm:px-2 lg:px-1.5 xl:px-2 py-1.5 text-xs font-semibold border-x border-gray-200 min-w-[1.75rem] sm:min-w-[2rem] text-center bg-white">
                              {product.quantity || 1}
                            </span>
                            <button
                              onClick={() =>
                                updatePopupQuantity(
                                  product.id,
                                  (product.quantity || 1) + 1
                                )
                              }
                              className="px-1.5 py-1.5 sm:px-2 lg:px-1.5 xl:px-2 text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition-colors active:bg-gray-300"
                              aria-label="Verhogen"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer - Sticky */}
              <div className="sticky bottom-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-t bg-white shadow-lg gap-3 shrink-0 z-10">
                {/* Summary */}
                <div className="flex items-center justify-between sm:justify-start sm:flex-col sm:items-start gap-2 sm:gap-1">
                  {(() => {
                    const selectedItems = allProducts.filter((p) =>
                      selectedProducts.has(p.id)
                    );
                    const totalQuantity = selectedItems.reduce(
                      (sum, p) => sum + (p.quantity || 1),
                      0
                    );
                    const totalPrice = selectedItems.reduce(
                      (sum, p) => sum + (p.price || 0) * (p.quantity || 1),
                      0
                    );

                    if (selectedProducts.size === 0) {
                      return (
                        <>
                          <span className="text-sm text-gray-500">Geen producten geselecteerd</span>
                          <span className="text-xs text-gray-400 hidden sm:block">Klik op producten om te selecteren</span>
                        </>
                      );
                    }

                    return (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-[#e8b960] via-[#d7aa43] to-[#c29635] text-white text-xs font-bold rounded-full shadow-lg shadow-[#d7aa43]/50 border-2 border-white ring-2 ring-[#f5d68a]/30"
                            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                          >
                            {totalQuantity}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {totalQuantity} item{totalQuantity !== 1 ? "s" : ""} geselecteerd
                          </span>
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-[#d7aa43]">
                          €{totalPrice.toFixed(2)}
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowProductsPopup(false)}
                    className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors active:scale-95"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={addSelectedProductsToCart}
                    disabled={selectedProducts.size === 0}
                    className="flex-1 sm:flex-none px-6 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base font-bold bg-gradient-to-br from-[#d7aa43] via-[#e8b960] to-[#c29635] text-white rounded-xl hover:shadow-2xl hover:shadow-[#d7aa43]/50 hover:scale-[1.02] hover:from-[#e8b960] hover:via-[#d7aa43] hover:to-[#b88a2e] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-500 active:scale-95 shadow-xl shadow-[#d7aa43]/30 uppercase tracking-wide border-2 border-[#f5d68a]/20 hover:border-[#f5d68a]/40 disabled:shadow-none disabled:border-none flex items-center justify-center gap-2"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.2)' }}
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>
                      {selectedProducts.size > 0
                        ? `Toevoegen${selectedProducts.size > 1 ? ` (${selectedProducts.size})` : ""}`
                        : "Selecteer producten"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auth Popup */}
        <CheckoutAuthPopup
          isOpen={showAuthPopup}
          onClose={() => {
            setShowAuthPopup(false);
            setAuthPopupMessage(undefined);
          }}
          onSuccess={() => {
            setShowAuthPopup(false);
            setAuthPopupMessage(undefined);
            // The form will automatically update thanks to the useEffect that watches for user changes
          }}
          message={authPopupMessage}
          initialEmail={formData.email}
          initialFirstName={formData.firstName}
          initialLastName={formData.lastName}
          initialPhone={formData.phone}
        />

        {/* Address Management Popup */}
        {showAddressManagementPopup && (
          <div className="fixed inset-0 z-[60] overflow-y-auto">
            {/* Overlay - donkerder op desktop */}
            <div 
              className="fixed inset-0 bg-black/40 md:bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => {
                setShowAddressManagementPopup(false);
                setShowNewAddressForm(false);
                setShowManualNewAddressInput(false);
                setNewAddressError("");
                setNewAddressFound(false);
              }}
            />
            
            {/* Popup container */}
            <div className="min-h-screen px-4 text-center flex items-center justify-center">
              {/* Center modal */}
              <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8 text-left overflow-hidden transform transition-all">
                {/* Header */}
                <div className="bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] px-6 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white">
                      {showNewAddressForm ? "Voeg nieuw adres toe" : "Kies ander bezorgadres"}
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddressManagementPopup(false);
                        setShowNewAddressForm(false);
                        setShowManualNewAddressInput(false);
                        setNewAddressError("");
                        setNewAddressFound(false);
                      }}
                      className="text-white hover:text-gray-200 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[75vh] overflow-y-auto">
                  {!showNewAddressForm ? (
                    <>
                      {/* Button: Nieuw adres toevoegen */}
                      <button
                        type="button"
                        onClick={() => setShowNewAddressForm(true)}
                        className="w-full mb-4 flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#d7aa43] rounded-xl text-[#814E1E] hover:bg-[#FFF9F0] hover:border-[#c29635] transition-all duration-300 font-medium"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Nieuw adres toevoegen
                      </button>

                      {/* List van adressen */}
                      <div className="space-y-3">
                        {previousAddresses.map((address) => {
                          const isSelected = formData.selectedAddressId === address.id || 
                            (!formData.selectedAddressId && previousAddresses.indexOf(address) === 0);
                          
                          return (
                            <div
                              key={address.id}
                              className={`relative border-2 rounded-xl p-4 transition-all cursor-pointer ${
                                isSelected
                                  ? "border-[#5B9BD5] bg-blue-50"
                                  : "border-gray-200 hover:border-gray-300 bg-white"
                              }`}
                              onClick={() => {
                                setFormData((prev: any) => ({
                                  ...prev,
                                  selectedAddressId: address.id,
                                  billingAddress: address.street.split(' ').slice(0, -1).join(' ') || address.street,
                                  billingHouseNumber: address.street.split(' ').slice(-1)[0] || "",
                                  billingHouseAddition: "",
                                  billingCity: address.city,
                                  billingPostcode: address.postalCode,
                                  billingCountry: address.country,
                                }));
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <h3 className="font-bold text-gray-900 mb-1">
                                    {address.name}
                                  </h3>
                                  <p className="text-sm text-gray-700">{address.fullName}</p>
                                  <p className="text-sm text-gray-700">{address.street}</p>
                                  <p className="text-sm text-gray-700">
                                    {address.postalCode} {address.city}
                                  </p>
                                  <p className="text-sm text-gray-700">
                                    {address.country === "NL" ? "Nederland" : address.country === "BE" ? "België" : address.country}
                                  </p>
                                  
                                  {isSelected && (
                                    <div className="flex items-center gap-2 mt-2">
                                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span className="text-sm font-medium text-green-600">Standaard bezorgadres</span>
                                    </div>
                                  )}
                                </div>
                                
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Set as selected and show edit form
                                    setFormData((prev: any) => ({
                                      ...prev,
                                      selectedAddressId: address.id,
                                      billingAddress: address.street.split(' ').slice(0, -1).join(' ') || address.street,
                                      billingHouseNumber: address.street.split(' ').slice(-1)[0] || "",
                                      billingHouseAddition: "",
                                      billingCity: address.city,
                                      billingPostcode: address.postalCode,
                                      billingCountry: address.country,
                                    }));
                                    setShowNewAddressForm(true);
                                  }}
                                  className="text-[#5B9BD5] hover:text-[#4A8BC2] text-sm font-medium"
                                >
                                  Wijzig
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Nieuw adres formulier */}
                      <div className="space-y-4">
                        {/* Error message */}
                        {newAddressError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {newAddressError}
                          </div>
                        )}

                        {/* Label optioneel */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-3">
                            Hoe wil je dit adres noemen?
                            <span className="ml-2 text-gray-500 text-xs">Optioneel</span>
                          </label>
                          <div className="flex gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="radio" 
                                name="addressLabel" 
                                value="Thuis"
                                checked={newAddress.label === "Thuis"}
                                onChange={(e) => setNewAddress({...newAddress, label: e.target.value})}
                                className="text-[#5B9BD5]" 
                              />
                              <span className="text-sm">Thuis</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="radio" 
                                name="addressLabel" 
                                value="Werk"
                                checked={newAddress.label === "Werk"}
                                onChange={(e) => setNewAddress({...newAddress, label: e.target.value})}
                                className="text-[#5B9BD5]" 
                              />
                              <span className="text-sm">Werk</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="radio" 
                                name="addressLabel" 
                                value="Anders"
                                checked={newAddress.label === "Anders"}
                                onChange={(e) => setNewAddress({...newAddress, label: e.target.value})}
                                className="text-[#5B9BD5]" 
                              />
                              <span className="text-sm">Anders</span>
                            </label>
                          </div>
                        </div>

                        {/* Naam velden */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Voornaam</label>
                            <input
                              type="text"
                              placeholder={formData.firstName || "Voornaam"}
                              value={newAddress.firstName}
                              onChange={(e) => setNewAddress({...newAddress, firstName: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B9BD5] focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tussenvoegsel</label>
                            <input
                              type="text"
                              placeholder="Tussenv."
                              value={newAddress.middleName}
                              onChange={(e) => setNewAddress({...newAddress, middleName: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B9BD5] focus:border-transparent"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Achternaam</label>
                          <input
                            type="text"
                            placeholder={formData.lastName || "Achternaam"}
                            value={newAddress.lastName}
                            onChange={(e) => setNewAddress({...newAddress, lastName: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B9BD5] focus:border-transparent"
                          />
                        </div>

                        {/* Adres velden */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Postcode *
                              {isLookingUpNewAddress && <span className="ml-2 text-xs text-blue-600">Bezig met laden...</span>}
                            </label>
                            <input
                              type="text"
                              placeholder="1111AA"
                              value={newAddress.postcode}
                              onChange={(e) => {
                                setNewAddress({...newAddress, postcode: e.target.value.toUpperCase().replace(/\s/g, "")});
                                setNewAddressError("");
                                setShowManualNewAddressInput(false);
                                setNewAddressFound(false);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B9BD5] focus:border-transparent uppercase"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Huisnummer *</label>
                            <input
                              type="text"
                              placeholder="Nr."
                              value={newAddress.houseNumber}
                              onChange={(e) => {
                                setNewAddress({...newAddress, houseNumber: e.target.value});
                                setNewAddressError("");
                                setShowManualNewAddressInput(false);
                                setNewAddressFound(false);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B9BD5] focus:border-transparent"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Toevoeging</label>
                          <input
                            type="text"
                            placeholder="Toev."
                            value={newAddress.addition}
                            onChange={(e) => setNewAddress({...newAddress, addition: e.target.value})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#5B9BD5] focus:border-transparent"
                          />
                        </div>

                        {/* Manual address input button - Only show for NL when manual input is not active */}
                        {newAddress.country === "NL" &&
                          !showManualNewAddressInput &&
                          !newAddressFound && (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowManualNewAddressInput(true);
                                  setNewAddressError("");
                                  setNewAddressFound(false);
                                }}
                                className="text-sm text-[#814E1E] hover:text-[#d7aa43] font-medium flex items-center gap-1.5 transition-colors"
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
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Voer adres handmatig in
                              </button>
                            </div>
                          )}

                        {/* Auto-filled fields */}
                        {newAddressFound && newAddress.street && (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm font-medium text-green-900">✓ Adres gevonden:</p>
                            <p className="text-sm text-green-700">{newAddress.street}</p>
                            <p className="text-sm text-green-700">{newAddress.city}</p>
                          </div>
                        )}

                        {/* Manual address input fields */}
                        {showManualNewAddressInput && (
                          <div className="border-t pt-4 space-y-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-gray-500"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <h4 className="text-sm font-medium text-gray-700">
                                  Adresgegevens handmatig invoeren
                                </h4>
                              </div>
                              {/* Back to automatic lookup button */}
                              {newAddress.country === "NL" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowManualNewAddressInput(false);
                                    setNewAddressError("");
                                    setNewAddressFound(false);
                                    // Clear manual fields
                                    setNewAddress((prev) => ({
                                      ...prev,
                                      street: "",
                                      city: "",
                                    }));
                                  }}
                                  className="text-xs text-[#814E1E] hover:text-[#d7aa43] font-medium flex items-center gap-1 transition-colors"
                                >
                                  <svg
                                    className="w-3.5 h-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                  Terug naar automatische opzoeking
                                </button>
                              )}
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Straatnaam en huisnummer *
                              </label>
                              <input
                                type="text"
                                value={newAddress.street}
                                onChange={(e) => setNewAddress({...newAddress, street: e.target.value})}
                                placeholder="Straatnaam en huisnummer"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Postcode *
                                </label>
                                <input
                                  type="text"
                                  value={newAddress.postcode}
                                  onChange={(e) => setNewAddress({...newAddress, postcode: e.target.value.toUpperCase().replace(/\s/g, "")})}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent uppercase"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Plaats *
                                </label>
                                <input
                                  type="text"
                                  value={newAddress.city}
                                  onChange={(e) => setNewAddress({...newAddress, city: e.target.value})}
                                  placeholder="Plaats"
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#d7aa43] focus:border-transparent"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Checkboxes */}
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={newAddress.setAsDefaultShipping}
                              onChange={(e) => setNewAddress({...newAddress, setAsDefaultShipping: e.target.checked})}
                              className="rounded text-[#5B9BD5]" 
                            />
                            <span className="text-sm text-gray-700">Stel in als standaard bezorgadres</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={newAddress.setAsDefaultBilling}
                              onChange={(e) => setNewAddress({...newAddress, setAsDefaultBilling: e.target.checked})}
                              className="rounded text-[#5B9BD5]" 
                            />
                            <span className="text-sm text-gray-700">Stel in als standaard factuuradres</span>
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (showNewAddressForm) {
                          setShowNewAddressForm(false);
                          setNewAddressError("");
                          setShowManualNewAddressInput(false);
                          setNewAddressFound(false);
                          setNewAddress({
                            label: "",
                            firstName: "",
                            middleName: "",
                            lastName: "",
                            postcode: "",
                            houseNumber: "",
                            addition: "",
                            street: "",
                            city: "",
                            country: "NL",
                            setAsDefaultShipping: false,
                            setAsDefaultBilling: false,
                          });
                        } else {
                          setShowAddressManagementPopup(false);
                        }
                      }}
                      className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      {showNewAddressForm ? "Annuleren" : "Annuleer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (showNewAddressForm) {
                          handleSaveNewAddress();
                        } else {
                          setShowAddressManagementPopup(false);
                        }
                      }}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] text-white rounded-lg font-bold hover:from-[#e8b960] hover:via-[#d7aa43] hover:to-[#b88a2e] hover:shadow-lg hover:shadow-[#d7aa43]/40 transition-all duration-300 border border-[#f5d68a]/30"
                      style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                    >
                      {showNewAddressForm ? "Opslaan" : "Bevestig"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Address Mismatch Warning Popup */}
        {showAddressMismatchWarning && knownAddressForPhone && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-amber-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  Afwijkend bezorgadres gedetecteerd ⚠️
                </h3>
                <p className="text-sm text-gray-600">
                  We hebben je eerder gezien met een ander bezorgadres
                </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
              {/* Known Address */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900 mb-2">
                      Eerder gebruikt bezorgadres:
                    </p>
                    <div className="text-sm text-blue-800 space-y-1">
                      <p className="font-medium">{knownAddressForPhone.street}</p>
                      <p>{knownAddressForPhone.postalCode} {knownAddressForPhone.city}</p>
                      <p>{knownAddressForPhone.country === "NL" ? "Nederland" : knownAddressForPhone.country === "BE" ? "België" : knownAddressForPhone.country}</p>
                    </div>
                  </div>
                </div>
              </div>

                {/* Current Address */}
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900 mb-2">
                        Nieuw ingevuld adres:
                      </p>
                      <div className="text-sm text-amber-800 space-y-1">
                        <p className="font-medium">
                          {formData.billingAddress} {formData.billingHouseNumber}{formData.billingHouseAddition}
                        </p>
                        <p>{formData.billingPostcode} {formData.billingCity}</p>
                        <p>{formData.billingCountry === "NL" ? "Nederland" : formData.billingCountry === "BE" ? "België" : formData.billingCountry}</p>
                      </div>
                    </div>
                  </div>
                </div>

              {/* Warning Message */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  <strong>Let op:</strong> Het adres dat je nu hebt ingevuld wijkt af van je gebruikelijke bezorgadres. 
                  Weet je zeker dat dit het juiste adres is voor deze bestelling?
                </p>
              </div>
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                <button
                  onClick={() => {
                    setAddressMismatchConfirmed(true);
                    setShowAddressMismatchWarning(false);
                    
                    // Automatically proceed to step 2 (payment) with the new address
                    setCurrentStep(2);
                    if (maxStepReached < 2) {
                      setMaxStepReached(2);
                      localStorage.setItem("checkoutMaxStepReached", "2");
                    }
                    
                    // Scroll to top
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full py-3 px-6 bg-gradient-to-br from-[#d7aa43] via-[#e8b960] to-[#c29635] text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-[#d7aa43]/50 hover:scale-[1.02] hover:from-[#e8b960] hover:via-[#d7aa43] hover:to-[#b88a2e] transition-all duration-500 shadow-xl shadow-[#d7aa43]/30 uppercase tracking-wide border-2 border-[#f5d68a]/20 hover:border-[#f5d68a]/40"
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                >
                  ✓ Ja, lever op het nieuwe adres
                </button>
                <button
                  onClick={() => {
                    // Fill in the known address
                    if (knownAddressForPhone) {
                      // Parse street and house number
                      const streetParts = knownAddressForPhone.street.split(" ");
                      const houseNumber = streetParts[streetParts.length - 1];
                      const street = streetParts.slice(0, -1).join(" ");
                      
                      setFormData((prev) => ({
                        ...prev,
                        billingAddress: street,
                        billingHouseNumber: houseNumber,
                        billingHouseAddition: "",
                        billingCity: knownAddressForPhone.city,
                        billingPostcode: knownAddressForPhone.postalCode,
                        billingCountry: knownAddressForPhone.country,
                      }));
                    }
                    setShowAddressMismatchWarning(false);
                    setAddressMismatchConfirmed(true);
                    
                    // Automatically proceed to step 2 (payment) with the old address
                    setCurrentStep(2);
                    if (maxStepReached < 2) {
                      setMaxStepReached(2);
                      localStorage.setItem("checkoutMaxStepReached", "2");
                    }
                    
                    // Scroll to top
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full py-3 px-6 bg-white text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-colors border-2 border-gray-300"
                >
                  ← Gebruik het gebruikelijke adres
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loyalty Redemption Popup (available globally on all checkout steps) */}
        <LoyaltyRedemptionPopup
          onCouponSelect={(code) => {
            // Apply discount code directly with the redeemed coupon code
            applyDiscountCode(code);
          }}
        />

        {/* NOTE: Bundle offers shown on other pages, NOT in checkout
            Checkout is only for data collection (email, IP tracking) */}

        {/* Delivery Info Popup */}
        {showDeliveryInfoPopup && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-6 h-6 text-blue-600"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19.5 12.5l-1.5-3h-3v-2c0-1.1-.9-2-2-2h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h.76c.55 1.19 1.74 2 3.24 2s2.69-.81 3.24-2h3.52c.55 1.19 1.74 2 3.24 2s2.69-.81 3.24-2h.76c.55 0 1-.45 1-1v-3.5c0-.83-.67-1.5-1.5-1.5zm-11.5 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm8 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3-3h-3v-2.5h2.5l.5 1v1.5z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Bezorginformatie
                  </h3>
                </div>
                <button
                  onClick={() => setShowDeliveryInfoPopup(false)}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-1 transition-colors"
                  aria-label="Sluiten"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {/* DHL Info */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg
                        className="w-5 h-5 text-yellow-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        Verzending via DHL
                      </h4>
                      <p className="text-sm text-gray-700">
                        Uw bestelling wordt verzonden met DHL, een van de meest
                        betrouwbare pakketbezorgers in Nederland.
                      </p>
                    </div>
                  </div>
                </div>

                {/* No Need to Be Home */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg
                        className="w-5 h-5 text-green-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        Niet thuis? Geen probleem!
                      </h4>
                      <p className="text-sm text-gray-700">
                        U hoeft niet thuis te zijn voor uw bestelling. Het pakket
                        kan bij de buren worden afgeleverd of in de brievenbus
                        worden geplaatst indien mogelijk.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg
                        className="w-5 h-5 text-gray-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        Track & Trace
                      </h4>
                      <p className="text-sm text-gray-700">
                        U ontvangt een Track & Trace code waarmee u uw pakket
                        realtime kunt volgen zodra het verzonden is.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Button */}
              <div className="mt-6">
                <button
                  onClick={() => setShowDeliveryInfoPopup(false)}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Begrepen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Suspense>
  );
}
