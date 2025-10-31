"use client";

// Testimonials section for the landing page
// Displays customer reviews using TrustIndex widget
// Lazy loads iframe for better performance

import { useEffect, useRef, useState } from "react";
import {
  useMediaQuery,
  breakpoints,
  deviceBreakpoints,
} from '@/hooks/useMediaQuery';

export default function Testimonials() {
  const isMobile = useMediaQuery(deviceBreakpoints.mobile);
  const isTablet = useMediaQuery(deviceBreakpoints.tablet);
  const isDesktop = useMediaQuery(deviceBreakpoints.desktop);
  
  // Lazy load iframe - only load when visible for better LCP
  const [shouldLoad, setShouldLoad] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Start loading 200px before visible
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`bg-[rgba(252,206,78,0.3)] ${
        isTablet ? "py-10 px-6" : isDesktop ? "py-12 px-[76px]" : "py-8 px-4"
      } flex flex-col items-center ${
        isTablet ? "gap-5" : "gap-6"
      } relative z-10`}
      data-name="Testimonials"
      id="testimonials-section">
      {/* Section heading for mobile */}
      {/* {isMobile && (
        <h2 className="text-[24px] font-[var(--font-eb-garamond)] text-center mb-2">
          What Our Customers Say
        </h2>
      )} */}

      {/* TrustIndex widget container - lazy loaded for better performance */}
      <div
        className={`w-full testimonial-iframe ${
          isTablet
            ? "max-w-[700px]"
            : isDesktop
            ? "max-w-[1800px]"
            : "max-w-[100%]"
        } flex justify-center`}>
        {shouldLoad ? (
          <iframe
            src="https://cdn.trustindex.io/amp-widget.html#502ce9a39f5d731f95560046340"
            title="Customer Reviews"
            loading="lazy"
            style={{
              width: "100%",
              height: isTablet ? "320px" : "350px",
              border: "none",
              position: "relative",
              zIndex: 20,
              backgroundColor: "transparent",
              overflow: "hidden",
            }}
          />
        ) : (
          <div 
            style={{
              width: "100%",
              height: isTablet ? "320px" : "350px",
              backgroundColor: "rgba(252,206,78,0.1)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#666", fontSize: "14px" }}>Reviews laden...</span>
          </div>
        )}
      </div>
    </section>
  );
}
