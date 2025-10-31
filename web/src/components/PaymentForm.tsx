"use client";

import { useEffect, useState, useMemo } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

interface PaymentFormProps {
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  amount: number;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  customerCountry?: string;
}

export default function PaymentForm({
  onSuccess,
  onError,
  amount,
  customerEmail,
  customerName,
  customerPhone,
  customerCountry,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [layout, setLayout] = useState<"tabs" | "accordion">("tabs");

  // 🧠 Responsive layout detection
  useEffect(() => {
    const updateLayout = () => {
      if (window.innerWidth < 640) {
        // mobile breakpoint (you can adjust)
        setLayout("accordion");
      } else {
        setLayout("tabs");
      }
    };

    updateLayout(); // run on mount
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // Memoize PaymentElement options to prevent unnecessary re-renders
  const paymentElementOptions = useMemo(() => ({
    layout: layout,
    paymentMethodOrder: ["ideal", "card", "bancontact"],
    defaultValues: {
      billingDetails: {
        name: customerName || "",
      },
    },
    fields: {
      billingDetails: {
        name: "auto" as const,
        email: "never" as const,
        phone: "never" as const,
        address: "never" as const,
      },
    },
  }), [layout, customerName]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setMessage("Stripe is nog niet geladen. Probeer het opnieuw.");
      return;
    }

    setIsProcessing(true);
    setMessage("");

    try {
      // Prepare confirm params
      const confirmParams: any = {
        return_url: `${window.location.origin}/checkout/success`,
      };
      // Add billing details if we have customer data
      if (customerEmail) {
        confirmParams.payment_method_data = {
          billing_details: {
            email: customerEmail,
            name: customerName || "",
            phone: customerPhone || "", // Phone from checkout or empty
            address: {
              country: customerCountry || "NL", // Default to Netherlands
              line1: null,
              line2: null,
              city: null,
              state: null,
              postal_code: null,
            },
          },
        };
      }

      // Confirm payment
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams,
        redirect: "if_required",
      });

      if (error) {
        // Handle payment errors
        let errorMessage = "Er is een fout opgetreden bij de betaling.";

        switch (error.type) {
          case "card_error":
          case "validation_error":
            errorMessage = error.message || errorMessage;
            break;
          case "invalid_request_error":
            errorMessage = "Ongeldige betalingsaanvraag. Probeer het opnieuw.";
            break;
          default:
            errorMessage =
              "Netwerkfout. Controleer je internetverbinding en probeer het opnieuw.";
            break;
        }
        setMessage(errorMessage);
        onError(errorMessage);
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        // Payment successful
        setMessage("Betaling succesvol! Je wordt doorverwezen...");
        onSuccess(paymentIntent.id);
      } else {
        // Payment requires additional action or is processing
        setMessage("Betaling wordt verwerkt...");
      }
      return;
    } catch (err) {
      console.error("Payment confirmation error:", err);
      const errorMessage =
        "Er is een onverwachte fout opgetreden. Probeer het opnieuw.";
      setMessage(errorMessage);
      onError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Element */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Kies een betaalmethode
        </label>
        <div className="border p-4 border-gray-300 rounded-lg ">
          <PaymentElement options={paymentElementOptions} />
        </div>
      </div>

      {/* Error/Success Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.includes("succesvol")
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-center">
            {message.includes("succesvol") ? (
              <svg
                className="w-5 h-5 mr-2"
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
              <svg
                className="w-5 h-5 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <span className="text-sm">{message}</span>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isProcessing || !stripe || !elements}
        className={`w-full py-4 px-8 rounded-xl font-bold text-lg tracking-wide transition-all duration-500 uppercase ${
          isProcessing || !stripe || !elements
            ? "bg-gray-400 text-gray-500 cursor-not-allowed opacity-50 shadow-none border-none"
            : "bg-gradient-to-br from-[#d7aa43] via-[#e8b960] to-[#c29635] md:bg-gradient-to-r md:from-[#d7aa43] md:to-[#e8b960] text-white hover:shadow-2xl hover:shadow-[#d7aa43]/50 hover:scale-[1.02] hover:from-[#e8b960] hover:via-[#d7aa43] hover:to-[#b88a2e] shadow-xl shadow-[#d7aa43]/30 border-2 border-[#f5d68a]/20 hover:border-[#f5d68a]/40"
        }`}
        style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
      >
        {isProcessing ? (
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Betaling verwerken...
          </div>
        ) : (
          `Betaal €${amount.toFixed(2)}`
        )}
      </button>

      {/* Payment Methods Info */}
      <div className="text-center">
        <p className="text-xs text-gray-500 mb-2">
          Ondersteunde betaalmethoden:
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">iDEAL</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
            Bancontact
          </span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">Visa</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
            Mastercard
          </span>
        </div>
      </div>
    </form>
  );
}
