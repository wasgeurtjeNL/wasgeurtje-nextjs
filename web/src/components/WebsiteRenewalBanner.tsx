"use client";

import { useState, useEffect } from "react";
import { X, Sparkles, Package, Mail } from "lucide-react";

export default function WebsiteRenewalBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    // Check if user has already seen and dismissed the banner
    const hasSeenBanner = localStorage.getItem("hasSeenRenewalBanner");
    
    if (!hasSeenBanner) {
      // Show banner after a small delay for better UX
      setTimeout(() => {
        setIsVisible(true);
      }, 1500);
    }
  }, []);

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      // Remember that user has dismissed the banner
      localStorage.setItem("hasSeenRenewalBanner", "true");
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-[9998] transition-opacity duration-300 ${
          isAnimatingOut ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleClose}
      />

      {/* Banner */}
      <div
        className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-[95%] sm:w-[90%] max-w-2xl max-h-[90vh] overflow-y-auto transition-all duration-300 ${
          isAnimatingOut 
            ? 'opacity-0 scale-95' 
            : 'opacity-100 scale-100'
        }`}
      >
        <div className="relative bg-gradient-to-br from-white via-[#FFF9F0] to-[#FFFCF5] rounded-xl sm:rounded-2xl shadow-2xl border-2 border-[#e9c356] overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-[#e9c356]/20 to-transparent rounded-full -mr-20 -mt-20 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-[#d6ad61]/20 to-transparent rounded-full -ml-16 -mb-16 blur-3xl"></div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 hover:bg-white text-gray-600 hover:text-gray-900 transition-all duration-200 hover:scale-110 shadow-md"
            aria-label="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="relative p-5 sm:p-8 md:p-10">
            {/* Header with icon */}
            <div className="flex items-center justify-center mb-4 sm:mb-6">
              <div className="relative">
                <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-[#e9c356] animate-pulse" />
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-[#d6ad61] rounded-full animate-ping"></div>
              </div>
            </div>

            {/* Main title */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-[#333333] mb-3 sm:mb-4 leading-tight">
              🎉 Onze Website is Vernieuwd!
            </h2>

            {/* Subtitle */}
            <p className="text-center text-[#814E1E] mb-6 sm:mb-8 text-base sm:text-lg">
              Ontdek een snellere, mooiere ervaring
            </p>

            {/* Info boxes */}
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
              {/* Same day shipping */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-4 sm:p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-full flex items-center justify-center shadow-md">
                      <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-green-900 mb-1 text-base sm:text-lg leading-tight">
                      Bestel vóór 23:59 = Vandaag Verzonden! 🚀
                    </h3>
                    <p className="text-green-800 text-xs sm:text-sm leading-relaxed">
                      Voor zowel Nederland als België - Geniet sneller van je favoriete wasgeurtjes
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact info */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-blue-500 p-4 sm:p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
                      <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-blue-900 mb-1 text-base sm:text-lg leading-tight">
                      Vragen of Problemen?
                    </h3>
                    <p className="text-blue-800 text-xs sm:text-sm mb-2 leading-relaxed">
                      Ons team staat voor je klaar!
                    </p>
                    <a
                      href="mailto:info@wasgeurtje.nl"
                      className="inline-flex items-center gap-1.5 sm:gap-2 text-blue-600 hover:text-blue-800 font-semibold hover:underline transition-colors text-sm sm:text-base break-all"
                    >
                      <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate">info@wasgeurtje.nl</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center items-stretch sm:items-center">
              <button
                onClick={handleClose}
                className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-gradient-to-r from-[#e9c356] to-[#d6ad61] text-white font-bold rounded-full hover:from-[#d6ad61] hover:to-[#c29b5a] transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 text-sm sm:text-base"
              >
                Ontdek de Nieuwe Website! ✨
              </button>
              <button
                onClick={handleClose}
                className="w-full sm:w-auto px-5 sm:px-6 py-2.5 sm:py-3 text-gray-600 hover:text-gray-900 font-medium transition-colors text-sm sm:text-base"
              >
                Sluiten
              </button>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs sm:text-sm text-gray-500 mt-4 sm:mt-6">
              Deze melding wordt slechts één keer getoond
            </p>
          </div>

          {/* Decorative bottom border */}
          <div className="h-2 bg-gradient-to-r from-[#e9c356] via-[#d6ad61] to-[#e9c356]"></div>
        </div>
      </div>
    </>
  );
}

