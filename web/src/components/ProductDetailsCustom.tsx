import React from "react";
import Testimonials from "./sections/Testimonials";
import Features from "./CustomFeatures";
import Sustainability from "./sections/Sustainability";
import HowItWorks from "./sections/HowItWorks";
import RewardProgram from "./sections/RewardProgram";
import OurStory from "./sections/OurStory";
import ComparisonTable from "./sections/ComparisonTable";
import TrialPackCard from "./sections/TrialPackCard";
import WhatInTheBox from "./sections/WhatInTheBox";
import { Product, RelatedProduct } from '@/types/product';
import { getProductBySlug } from '@/utils/woocommerce';
import { notFound } from "next/navigation";
import ProductInfo from "./sections/ProductInfo";
import RunningUSPStrip from "./sections/RunningUSPStrip";
import StickyCartBar from "./StikcyCartBar";
import ProefpakketBanner from "./sections/ProefpakketBanner";
import { FAQSection } from "./page-builder";
import FaqDropdownSection from "./FaqDropdownSection";
import TestimonialsAccordion from "./FaqDropdownSection";
import NewBenefitsSection from "./NewBenefitsSection";

interface ProductDetailsCustomProps {
  product: Product;
  relatedProducts?: RelatedProduct[];
}

const ProductDetailsCustom: React.FC<ProductDetailsCustomProps> = async ({
  product,
  relatedProducts,
}) => {
  // const product = await getProductBySlug(params.slug);
  // fetch product server-side (safe - API keys remain server-side)
  const TrialPackCardsData: Product | null = await getProductBySlug(
    "proefpakket"
  );

  if (!TrialPackCard) {
    notFound();
  }

  return (
    <div>
      <ProductInfo productInfo={product} />
      <WhatInTheBox relatedProducts={relatedProducts} />
      <TestimonialsAccordion />

      <ProefpakketBanner />
      {/* accordion */}
      {/* product show case */}
      <HowItWorks />
      {/* Waarom kiezen  */}
      <NewBenefitsSection />
      <ComparisonTable />
      <RunningUSPStrip />
      {/* <Features /> */}
      {/* <Testimonials /> */}
      {/* <TrialPackCard TrialPackCardsData={TrialPackCardsData} /> */}
      {/* <Sustainability /> */}
      <RewardProgram />
      <OurStory />
      <StickyCartBar product={product} />
    </div>
  );
};

export default ProductDetailsCustom;
