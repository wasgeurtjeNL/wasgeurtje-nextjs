"use client";

import { useState, useEffect, useRef } from "react";
import { useMediaQuery, deviceBreakpoints } from '@/hooks/useMediaQuery';
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import MobileSearch from "@/components/MobileSearch";

export default function FigmaHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isMenuAnimating, setIsMenuAnimating] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { openCart, cartCount } = useCart();
  const { user, isLoggedIn, logout } = useAuth();

  const isMobile = useMediaQuery(deviceBreakpoints.mobile);

  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  // --- Outside click detection for both menus ---
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Close account dropdown if clicked outside
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountMenuOpen(false);
      }

      // Close mobile menu if clicked outside (excluding toggle button)
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        !mobileMenuButtonRef.current?.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Automatically close menus when any link is clicked ---
  const handleLinkClick = () => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
  };

  // Toggle mobile menu with animation
  const toggleMobileMenu = () => {
    if (mobileMenuOpen) {
      setIsMenuAnimating(true);
      setTimeout(() => {
        setMobileMenuOpen(false);
        setIsMenuAnimating(false);
        setMobileSearchOpen(false); // Reset search when closing menu
      }, 300);
    } else {
      setMobileMenuOpen(true);
    }
  };

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  return (
    <>
      {/* Header */}
      <div className="bg-black w-full fixed top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 h-[86px]">
            {/* Mobile hamburger - Animated */}
            <div className="flex lg:hidden md:mr-4">
              <button
                ref={mobileMenuButtonRef}
                className="relative flex items-center justify-center w-10 h-10 rounded-lg text-white focus:outline-none hover:bg-white/10 transition-all duration-300 group"
                onClick={toggleMobileMenu}
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle menu">
                <div className="flex flex-col items-center justify-center w-6 h-6 relative">
                  {/* Top line */}
                  <span
                    className={`absolute w-6 h-0.5 bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#f5d68a] rounded-full transition-all duration-300 ease-in-out ${
                      mobileMenuOpen
                        ? "rotate-45 top-1/2 -translate-y-1/2"
                        : "top-1 group-hover:w-7"
                    }`}
                  />
                  {/* Middle line */}
                  <span
                    className={`absolute w-6 h-0.5 bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#f5d68a] rounded-full top-1/2 -translate-y-1/2 transition-all duration-300 ease-in-out ${
                      mobileMenuOpen
                        ? "opacity-0 scale-0"
                        : "opacity-100 scale-100 group-hover:w-5"
                    }`}
                  />
                  {/* Bottom line */}
                  <span
                    className={`absolute w-6 h-0.5 bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#f5d68a] rounded-full transition-all duration-300 ease-in-out ${
                      mobileMenuOpen
                        ? "-rotate-45 top-1/2 -translate-y-1/2"
                        : "bottom-1 group-hover:w-7"
                    }`}
                  />
                </div>
              </button>
            </div>

            {/* Logo */}
            <Link
              href="/"
              className="flex flex-col items-center"
              onClick={handleLinkClick}>
              <Image
                src="/figma/header/logo.png"
                alt="Wasgeurtje Logo"
                width={isMobile ? 180 : 200}
                height={isMobile ? 50 : 56}
                priority
                className={`w-auto ${
                  isMobile ? "!w-[180px] md:h-[50px]" : "h-14"
                }`}
              />
            </Link>

            {/* Desktop nav */}
            <div className="hidden lg:flex lg:items-center lg:space-x-8 flex-1 justify-center">
              <Link
                href="/blogs"
                onClick={handleLinkClick}
                className="text-white uppercase text-sm font-medium">
                BLOGS
              </Link>
              <Link
                href="/wasparfum"
                onClick={handleLinkClick}
                className="text-white uppercase text-sm font-medium">
                WASPARFUM
              </Link>
              <Link
                href="/wasparfum/proefpakket"
                onClick={handleLinkClick}
                className="text-white uppercase text-sm font-medium">
                WASPARFUM PROEFPakket
              </Link>
              <Link
                href="/contact"
                onClick={handleLinkClick}
                className="text-white uppercase text-sm font-medium">
                CONTACT
              </Link>
            </div>

            {/* Account + cart */}
            <div className="flex items-center space-x-4 shrink-0">
              {/* Account dropdown */}
              <div className="relative" ref={accountMenuRef}>
                <button
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className="text-white flex items-center space-x-2">
                  {isLoggedIn && user?.avatar ? (
                    <div className="relative flex-shrink-0">
                      <Image
                        src={user.avatar}
                        alt="Profile"
                        width={isMobile ? 29 : 24}
                        height={isMobile ? 29 : 24}
                        className={`${
                          isMobile ? "w-[29px] h-[29px]" : "w-6 h-6"
                        } rounded-full object-cover border-2 border-[#D6AD61]`}
                      />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#22C55E] rounded-full border-2 border-black" />
                    </div>
                  ) : (
                    <Image
                      src="/figma/header/user-icon.svg"
                      alt="Account"
                      width={isMobile ? 26 : 26}
                      height={isMobile ? 26 : 26}
                      className={isMobile ? "w-[29px] h-[29px]" : "w-6 h-6"}
                    />
                  )}
                  {isLoggedIn && !isMobile && (
                    <span className="text-sm font-medium hidden lg:block text-white">
                      {user?.firstName || "Account"}
                    </span>
                  )}
                </button>

                {/* Dropdown content - Luxe versie */}
                {accountMenuOpen && (
                  <div className="absolute right-0 top-full mt-3 w-72 bg-gradient-to-br from-white via-white to-[#FFF9F0] rounded-2xl shadow-2xl border-2 border-[#d7aa43]/20 z-50 overflow-hidden animate-slideDown">
                    {isLoggedIn ? (
                      <>
                        {/* Header met gradient */}
                        <div className="p-5 bg-gradient-to-r from-[#d7aa43] via-[#e8b960] to-[#c29635] relative overflow-hidden">
                          <div className="absolute inset-0 bg-black/5" />
                          <div className="relative flex items-center space-x-3">
                            {user?.avatar && (
                              <div className="relative">
                                <Image
                                  src={user.avatar}
                                  alt="Profile"
                                  width={48}
                                  height={48}
                                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-lg"
                                />
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#22C55E] rounded-full border-2 border-white" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white truncate text-base">
                                {user?.displayName}
                              </p>
                              <p className="text-xs text-white/80 truncate">
                                {user?.email}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Menu items */}
                        <div className="p-2">
                          <Link
                            href="/account"
                            onClick={handleLinkClick}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-[#d7aa43]/10 hover:to-[#c29635]/5 rounded-lg transition-all duration-200 group">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#d7aa43]/20 to-[#c29635]/10 group-hover:from-[#d7aa43]/30 group-hover:to-[#c29635]/20 transition-all">
                              <svg className="w-4 h-4 text-[#814E1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <span>Mijn Account</span>
                          </Link>
                          <Link
                            href="/account/orders"
                            onClick={handleLinkClick}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-[#d7aa43]/10 hover:to-[#c29635]/5 rounded-lg transition-all duration-200 group">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#d7aa43]/20 to-[#c29635]/10 group-hover:from-[#d7aa43]/30 group-hover:to-[#c29635]/20 transition-all">
                              <svg className="w-4 h-4 text-[#814E1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                              </svg>
                            </div>
                            <span>Mijn Bestellingen</span>
                          </Link>
                          <Link
                            href="/account/loyalty"
                            onClick={handleLinkClick}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-[#d7aa43]/10 hover:to-[#c29635]/5 rounded-lg transition-all duration-200 group relative">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/10 group-hover:from-green-500/30 group-hover:to-green-600/20 transition-all">
                              <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                              </svg>
                            </div>
                            <span className="flex items-center gap-2">
                              Loyalty Rewards
                              {user?.loyalty && user.loyalty.points >= 60 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  {Math.floor(user.loyalty.points / 60)}
                                </span>
                              )}
                            </span>
                          </Link>
                          <Link
                            href="/account/profile"
                            onClick={handleLinkClick}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-[#d7aa43]/10 hover:to-[#c29635]/5 rounded-lg transition-all duration-200 group">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#d7aa43]/20 to-[#c29635]/10 group-hover:from-[#d7aa43]/30 group-hover:to-[#c29635]/20 transition-all">
                              <svg className="w-4 h-4 text-[#814E1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </div>
                            <span>Instellingen</span>
                          </Link>
                          
                          {/* Divider */}
                          <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent my-2" />
                          
                          <button
                            onClick={() => {
                              logout();
                              handleLinkClick();
                            }}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 w-full group">
                            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 group-hover:bg-red-100 transition-all">
                              <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                              </svg>
                            </div>
                            <span>Uitloggen</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-2">
                        <Link
                          href="/auth/login"
                          onClick={handleLinkClick}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-[#d7aa43]/10 hover:to-[#c29635]/5 rounded-lg transition-all duration-200 group">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#d7aa43]/20 to-[#c29635]/10 group-hover:from-[#d7aa43]/30 group-hover:to-[#c29635]/20 transition-all">
                            <svg className="w-4 h-4 text-[#814E1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                          </div>
                          <span>Inloggen</span>
                        </Link>
                        <Link
                          href="/auth/register"
                          onClick={handleLinkClick}
                          className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gradient-to-r hover:from-[#d7aa43]/10 hover:to-[#c29635]/5 rounded-lg transition-all duration-200 group">
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#d7aa43]/20 to-[#c29635]/10 group-hover:from-[#d7aa43]/30 group-hover:to-[#c29635]/20 transition-all">
                            <svg className="w-4 h-4 text-[#814E1E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                          </div>
                          <span>Account Aanmaken</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Cart */}
              <button onClick={openCart} className="relative text-white">
                <Image
                  src="/figma/header/cart-icon.svg"
                  alt="Cart"
                  width={isMobile ? 26 : 22}
                  height={isMobile ? 26 : 22}
                  className={isMobile ? "w-[29px] h-[29px]" : "w-6 h-6"}
                />
                {cartCount > 0 && (
                  <span
                    className={`absolute ${
                      isMobile ? "-top-2.5 -right-2.5" : "-top-2 -right-2"
                    } bg-[#FCCE4E] text-black text-xs font-bold rounded-full ${
                      isMobile ? "w-6 h-6" : "w-5 h-5"
                    } flex items-center justify-center`}>
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Luxe Mobile Menu - Full Screen Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 bg-black/60 backdrop-blur-md z-[45] lg:hidden transition-opacity duration-300 ${
              isMenuAnimating ? "opacity-0" : "opacity-100"
            }`}
            onClick={toggleMobileMenu}
          />

          {/* Menu Panel */}
          <div
            ref={mobileMenuRef}
            className={`fixed top-[86px] left-0 right-0 bottom-0 z-50 lg:hidden transition-all duration-300 ease-out ${
              isMenuAnimating ? "translate-y-[-100%] opacity-0" : "translate-y-0 opacity-100"
            }`}>
            <div className="h-full bg-gradient-to-br from-black via-[#1a1207] to-black overflow-y-auto">
              {/* Decorative top gradient bar */}
              <div className="h-1 bg-gradient-to-r from-transparent via-[#d7aa43] to-transparent opacity-50" />

              {/* Menu Items Container */}
              <div className="flex flex-col py-8 px-6 space-y-2">
                {/* Search */}
                {!mobileSearchOpen ? (
                  <button
                    onClick={() => setMobileSearchOpen(true)}
                    className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 hover:border-[#d7aa43]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#d7aa43]/20 w-full"
                    style={{ animationDelay: "0ms", animation: "slideInFromLeft 0.4s ease-out forwards" }}>
                    <div className="flex items-center gap-4 px-6 py-5">
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-[#d7aa43]/20 to-[#c29635]/10 group-hover:from-[#d7aa43]/30 group-hover:to-[#c29635]/20 transition-all duration-300">
                        <svg className="w-6 h-6 text-[#d7aa43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-semibold text-lg tracking-wide group-hover:text-[#e8b960] transition-colors duration-300">
                          ZOEKEN
                        </div>
                        <div className="text-gray-400 text-xs mt-0.5">Vind jouw product</div>
                      </div>
                      <svg className="w-5 h-5 text-[#d7aa43]/50 group-hover:text-[#d7aa43] group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ) : (
                  <div className="rounded-xl bg-gradient-to-br from-black via-[#1a1207] to-black border border-[#d7aa43]/30 overflow-hidden">
                    {/* Close Button */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                      <div className="text-white font-semibold text-lg tracking-wide">
                        ZOEKEN
                      </div>
                      <button
                        onClick={() => setMobileSearchOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <MobileSearch onClose={() => {
                      setMobileSearchOpen(false);
                      toggleMobileMenu();
                    }} />
                  </div>
                )}

                {/* Blogs */}
                <Link
                  href="/blogs"
                  onClick={() => {
                    handleLinkClick();
                    toggleMobileMenu();
                  }}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 hover:border-[#d7aa43]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#d7aa43]/20"
                  style={{ animationDelay: "100ms", animation: "slideInFromLeft 0.4s ease-out forwards" }}>
                  <div className="flex items-center gap-4 px-6 py-5">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-[#d7aa43]/20 to-[#c29635]/10 group-hover:from-[#d7aa43]/30 group-hover:to-[#c29635]/20 transition-all duration-300">
                      <svg className="w-6 h-6 text-[#d7aa43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold text-lg tracking-wide group-hover:text-[#e8b960] transition-colors duration-300">
                        BLOGS
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5">Lees onze verhalen</div>
                    </div>
                    <svg className="w-5 h-5 text-[#d7aa43]/50 group-hover:text-[#d7aa43] group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>

                {/* Wasparfum */}
                <Link
                  href="/wasparfum"
                  onClick={() => {
                    handleLinkClick();
                    toggleMobileMenu();
                  }}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 hover:border-[#d7aa43]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#d7aa43]/20"
                  style={{ animationDelay: "200ms", animation: "slideInFromLeft 0.4s ease-out forwards" }}>
                  <div className="flex items-center gap-4 px-6 py-5">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-[#d7aa43]/20 to-[#c29635]/10 group-hover:from-[#d7aa43]/30 group-hover:to-[#c29635]/20 transition-all duration-300">
                      <svg className="w-6 h-6 text-[#d7aa43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold text-lg tracking-wide group-hover:text-[#e8b960] transition-colors duration-300">
                        WASPARFUM
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5">Ontdek onze geuren</div>
                    </div>
                    <svg className="w-5 h-5 text-[#d7aa43]/50 group-hover:text-[#d7aa43] group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>

                {/* Proefpakket */}
                <Link
                  href="/wasparfum/proefpakket"
                  onClick={() => {
                    handleLinkClick();
                    toggleMobileMenu();
                  }}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 hover:border-[#d7aa43]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#d7aa43]/20"
                  style={{ animationDelay: "300ms", animation: "slideInFromLeft 0.4s ease-out forwards" }}>
                  <div className="flex items-center gap-4 px-6 py-5">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-[#d7aa43]/20 to-[#c29635]/10 group-hover:from-[#d7aa43]/30 group-hover:to-[#c29635]/20 transition-all duration-300">
                      <svg className="w-6 h-6 text-[#d7aa43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold text-lg tracking-wide group-hover:text-[#e8b960] transition-colors duration-300">
                        PROEFPAKKET
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5">Probeer alle geuren</div>
                    </div>
                    <span className="px-2 py-1 text-xs font-bold text-black bg-[#FCCE4E] rounded-full">
                      POPULAIR
                    </span>
                    <svg className="w-5 h-5 text-[#d7aa43]/50 group-hover:text-[#d7aa43] group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>

                {/* Contact */}
                <Link
                  href="/contact"
                  onClick={() => {
                    handleLinkClick();
                    toggleMobileMenu();
                  }}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-white/5 to-white/[0.02] backdrop-blur-sm border border-white/10 hover:border-[#d7aa43]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#d7aa43]/20"
                  style={{ animationDelay: "400ms", animation: "slideInFromLeft 0.4s ease-out forwards" }}>
                  <div className="flex items-center gap-4 px-6 py-5">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-[#d7aa43]/20 to-[#c29635]/10 group-hover:from-[#d7aa43]/30 group-hover:to-[#c29635]/20 transition-all duration-300">
                      <svg className="w-6 h-6 text-[#d7aa43]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-white font-semibold text-lg tracking-wide group-hover:text-[#e8b960] transition-colors duration-300">
                        CONTACT
                      </div>
                      <div className="text-gray-400 text-xs mt-0.5">Neem contact op</div>
                    </div>
                    <svg className="w-5 h-5 text-[#d7aa43]/50 group-hover:text-[#d7aa43] group-hover:translate-x-1 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              </div>

              {/* Bottom decoration */}
              <div className="px-6 pb-8 mt-8">
                <div className="rounded-xl bg-gradient-to-r from-[#d7aa43]/10 to-[#c29635]/5 border border-[#d7aa43]/20 p-6 text-center">
                  <div className="text-[#e8b960] font-semibold mb-2">✨ Luxe Wasgeurtjes</div>
                  <div className="text-gray-400 text-sm">Duurzaam & Biologisch</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add CSS animations */}
      <style jsx global>{`
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideDown {
          animation: slideDown 0.2s ease-out forwards;
        }
      `}</style>
    </>
  );
}
