"use client";

import { useMediaQuery, breakpoints } from '@/hooks/useMediaQuery';
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { getPersonalizedGreeting, getDaySpecificGreeting } from '@/utils/greeting';
import { useState, useEffect } from 'react';

const imgImage287 = "/figma/hero-image-287.png";
const imgImage288 = "/figma/Mobile-Background-2.webp";
const imgStar = "/figma/star.svg";

// CRO-geoptimaliseerde voordelen die dynamisch wisselen
const benefits = [
  "Voor handdoeken die wekenlang fris blijven ruiken",
  "Je beddengoed ruikt als een 5-sterren hotel",
  "Elke wasbeurt wordt een luxe ervaring",
  "Die net-gewassen geur blijft wekenlang hangen",
  "Je garderobe ruikt als een Italiaanse parfumerie",
  "Stap elke ochtend in heerlijk geurende kleding",
  "Lakens met de geur van pure luxe",
  "Geniet van een subtiele spa-geur door heel je huis",
];

export default function HeroSection() {
  const isDesktop = useMediaQuery(breakpoints.lg);
  const { user, isLoggedIn, orders } = useAuth();
  const [currentBenefitIndex, setCurrentBenefitIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const greeting = user ? getPersonalizedGreeting(user.firstName || user.displayName, { includeEmoji: true }) : "";
  const isSpecialDay = getDaySpecificGreeting() !== null;

  // Wissel voordelen elke 4.5 seconden voor een premium gevoel
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentBenefitIndex((prev) => (prev + 1) % benefits.length);
        setIsTransitioning(false);
      }, 500);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="relative overflow-hidden"
      style={{ height: isDesktop ? "772px" : "auto" }}
      data-name="Hero section"
      data-node-id="71:4862">
      {/* Main container with columns (flex on desktop, stack on mobile) */}
      <div className={`${isDesktop ? "flex" : "flex flex-col"} h-full`}>
        {/* Column with gold gradient background */}
        <div
          className={`relative ${isDesktop ? "w-[47%]" : "w-full"} ${
            isDesktop ? "h-full" : "h-[450px]"
          }`}>
          {/* Gold gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(252,206,78,0.95) 0%, rgba(214,173,97,0.92) 45%, rgba(198,153,74,0.9) 100%)",
            }}
          />

          {/* Content column aligned to left */}
          <div
            className={`absolute left-0 top-0 w-full h-full box-border flex flex-col gap-3 items-start justify-start ${
              isDesktop ? "pt-12 px-[72px]" : "pt-10 px-6"
            } pb-0 z-10`}>
            
            {/* Personalized Welcome Message */}
            {isLoggedIn && user && (
              <div className="mx-auto md:mx-0 animate-fadeIn">
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2.5 shadow-md border border-white/60">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{isSpecialDay ? '🎉' : '✨'}</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[#1a1a1a]">
                        {greeting}!
                      </span>
                      {user.loyalty && user.loyalty.points > 0 && (
                        <span className="text-xs text-[#B8860B] font-medium">
                          {user.loyalty.points} punten 🌟
                          {user.loyalty.points >= 60 && " · Klaar om in te wisselen!"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mx-auto md:mx-[unset] relative shrink-0 bg-white/95 backdrop-blur-sm rounded-full px-5 py-2 box-border flex items-center gap-3 shadow-lg border border-white/50">
              <div className="relative shrink-0 flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="relative shrink-0 size-[16px]">
                    <img
                      alt=""
                      className="block max-w-none size-full drop-shadow-sm"
                      src={imgStar}
                    />
                  </div>
                ))}
              </div>
              <div className="relative shrink-0 text-[#212529] font-medium text-[15px] tracking-tight">
                <p className="leading-none">1400+ reviews</p>
              </div>
            </div>

            <div
              className={`relative shrink-0 text-[#1a1a1a] ${
                isDesktop ? "" : "text-center"
              }`}>
              <h1 className={`font-[var(--font-eb-garamond)] leading-[1.12] ${
                isDesktop ? "text-[58px]" : "text-[34px]"
              }`}>
                <span className="block font-light tracking-wide">Luxe wasparfums</span>
                <span className="block font-bold tracking-tight mt-1">
                  die <span className="italic font-semibold text-[#B8860B] relative">uitzonderlijk</span> lang
                </span>
                <span className="block font-bold tracking-tight">blijven hangen</span>
              </h1>
            </div>

            {!isLoggedIn && (
              <div
                className={`relative shrink-0 mt-2 ${
                  isDesktop ? "max-w-[480px]" : "w-full px-4"
                }`}>
                <div className="relative">
                  {/* Elegante onderstreping */}
                  <div className="absolute -top-2 left-0 w-12 h-[1px] bg-gradient-to-r from-[#B8860B] to-transparent opacity-60"></div>
                  
                  <p 
                    className={`font-[var(--font-eb-garamond)] font-light italic tracking-wide transition-all duration-1000 ease-in-out text-[#2a2a2a] ${
                      isDesktop ? "text-[20px] leading-[1.5]" : "text-[18px] leading-[1.4]"
                    }`}
                    style={{
                      opacity: isTransitioning ? 0 : 1,
                      transform: isTransitioning ? 'translateY(10px)' : 'translateY(0)',
                    }}>
                    {benefits[currentBenefitIndex]}
                  </p>
                </div>
              </div>
            )}

            <Link
              href={isLoggedIn && orders && orders.length > 0 ? "/shop" : "/wasparfum"}
              className="relative hidden lg:inline-flex  flex-shrink-0 bg-black text-white uppercase rounded-[4px] h-11  items-center justify-center px-14 hover:bg-[#1a1a1a] transition-colors">
              <span className="text-[16px] leading-[1.5]">
                {isLoggedIn && orders && orders.length > 0 ? "Shop favorieten" : "Ontdek nu"}
              </span>
            </Link>
          </div>
        </div>

        {/* Column with image */}
        <div
          className={`relative ${
            isDesktop
              ? "flex-1"
              : "w-full min-h-[400px] sm:min-h-[550px] md:min-h-[750px] mt-[-200px]"
          }`}>
          {/* Desktop hero image with priority loading */}
          <div className="absolute inset-0 lg:block hidden">
            <Image
              src={imgImage287}
              alt="Luxe wasparfum hero"
              fill
              priority
              fetchPriority="high"
              quality={90}
              sizes="(min-width: 1024px) 53vw, 0vw"
              style={{
                objectFit: "cover",
                objectPosition: "right bottom",
              }}
            />
          </div>
          
          {/* Mobile hero image with priority loading */}
          <div className="absolute inset-0 lg:hidden flex items-end justify-center">
            <Image
              src={imgImage288}
              alt="Luxe wasparfum hero mobiel"
              fill
              priority
              fetchPriority="high"
              quality={90}
              sizes="(max-width: 1023px) 100vw, 0vw"
              style={{
                objectFit: "cover",
                objectPosition: "top",
              }}
            />
            <Link
              href={isLoggedIn && orders && orders.length > 0 ? "/shop" : "/wasparfum"}
              className="relative z-10 inline-flex flex-shrink-0 bg-black text-white uppercase rounded-[4px] h-11 items-center justify-center px-14 mb-10 hover:bg-[#1a1a1a] transition-colors">
              <span className="text-[16px] leading-[1.5]">
                {isLoggedIn && orders && orders.length > 0 ? "Shop favorieten" : "Ontdek nu"}
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
