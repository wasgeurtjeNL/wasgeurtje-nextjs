import { Metadata } from "next";
import { notFound } from "next/navigation";
import { WordPressService } from "@/services/wordpress-service";
import PageBuilder from "@/components/page-builder/PageBuilder";
import Footer from "@/components/sections/Footer";
import { BASE_URL } from "@/config/site";

// SEO Metadata (exacte match met WordPress Yoast) - Met absolute URLs voor SEO
export const metadata: Metadata = {
  title: "Ontdek Topkwaliteit Wasparfum | Wasgeurtje.nl - Gratis Bezorging",
  description:
    "✓ Gratis verzending bij Wasgeurtje.nl ✓ Langdurig geurende wasparfum voor elke wasbeurt. Vind jouw favoriet uit onze exclusieve collectie en geniet van onweerstaanbare frisheid!",
  keywords: [
    "wasparfum",
    "wasgeurtje",
    "wasgeur",
    "wasparfum kopen",
    "beste wasparfum",
    "luxe wasparfum",
  ],
  openGraph: {
    title: "Ontdek Topkwaliteit Wasparfum | Wasgeurtje.nl - Gratis Bezorging",
    description:
      "✓ Gratis verzending bij Wasgeurtje.nl ✓ Langdurig geurende wasparfum voor elke wasbeurt. Vind jouw favoriet uit onze exclusieve collectie en geniet van onweerstaanbare frisheid!",
    type: "website",
    url: `${BASE_URL}/wasparfum`, // Absolute URL voor SEO
  },
  twitter: {
    card: "summary_large_image",
    title: "Ontdek Topkwaliteit Wasparfum | Wasgeurtje.nl",
    description:
      "Langdurig geurende wasparfum voor elke wasbeurt. Gratis bezorging en exclusieve collectie.",
  },
  alternates: {
    canonical: `${BASE_URL}/wasparfum`, // Absolute canonical URL (SEO vereist)
  },
};

// JSON-LD Structured Data with absolute URLs for proper SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${BASE_URL}/wasparfum`,
  url: `${BASE_URL}/wasparfum`,
  name: "Wasparfum - Luxe Wasparfums voor Heerlijk Geurende Was",
  description:
    "Ontdek onze exclusieve wasparfum collectie. Gratis verzending, langdurig geurend en geschikt voor alle soorten was.",
  inLanguage: "nl-NL",
  isPartOf: {
    "@type": "WebSite",
    "@id": BASE_URL,
    name: "Wasgeurtje.nl",
    url: BASE_URL,
  },
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Wasparfum",
        item: `${BASE_URL}/wasparfum`,
      },
    ],
  },
};

export default async function WasparfumPage() {
  try {
    // Fetch WordPress data
    const { page, sectionsWithData } =
      await WordPressService.getWasparfumPageComplete();

    if (!page) {
      notFound();
    }

    return (
      <>
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <main className="wasparfum-page">
          {/* Page Builder Content */}
          {sectionsWithData && sectionsWithData.length > 0 && (
            <PageBuilder sections={sectionsWithData} />
          )}
        </main>

        {/* <Footer /> */}
      </>
    );
  } catch (error) {
    console.error("Error rendering wasparfum page:", error);
    notFound();
  }
}
