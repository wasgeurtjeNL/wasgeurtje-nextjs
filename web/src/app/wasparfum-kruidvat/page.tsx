import { Metadata } from "next";
import TextContent from "@/components/sections/TextContent";
import ImageTextBlock from "@/components/sections/ImageTextBlock";
import ProductShowcase from "@/components/sections/ProductShowcase";
import { fetchPage, extractSEOData } from "@/utils/wordpress-api";
import { transformWordPressProducts } from "@/lib/wordpress-api";

// Generate metadata for SEO
export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await fetchPage("wasparfum-kruidvat");
    const seo = extractSEOData(page);

    return {
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords,
      openGraph: {
        title: seo.ogTitle,
        description: seo.ogDescription,
        url: seo.ogUrl,
        siteName: seo.ogSiteName,
        locale: seo.ogLocale,
        type: seo.ogType as any,
      },
      twitter: {
        card: seo.twitterCard as any,
        title: seo.twitterTitle,
        description: seo.twitterDescription,
        site: seo.twitterSite,
      },
      alternates: {
        canonical: seo.canonical,
      },
    };
  } catch (error) {
    return {
      title: "Wasparfum Kruidvat - Wasgeurtje",
      description: "Ontdek het verschil tussen Wasgeurtje en wasparfum Kruidvat",
    };
  }
}

export default async function WasparfumKruidvatPage() {
  console.log(`[WasparfumKruidvatPage] 🚀 Loading wasparfum-kruidvat page...`);
  
  try {
    // Fetch page data from WordPress
    console.log(`[WasparfumKruidvatPage] 📡 Calling fetchPage...`);
    const page = await fetchPage("wasparfum-kruidvat");
    console.log(`[WasparfumKruidvatPage] ✅ Page fetched successfully`);

    if (!page) {
      console.error(`[WasparfumKruidvatPage] ❌ Page is null/undefined`);
      return (
        <main className="min-h-screen bg-[#F8F6F0]">
          <div className="container mx-auto px-4 py-16">
            <h1 className="text-4xl font-bold text-center">
              Wasparfum Kruidvat - Pagina niet gevonden
            </h1>
          </div>
        </main>
      );
    }

    console.log(`[WasparfumKruidvatPage] 📄 Page data:`, {
      id: page.id,
      title: page.title?.rendered,
      hasACF: !!page.acf,
      acfKeys: page.acf ? Object.keys(page.acf) : [],
      hasPageBuilder: !!page.acf?.page_builder
    });

    // Extract ACF page_builder sections
    const sections = page.acf?.page_builder || [];

    console.log(`[WasparfumKruidvatPage] 🎨 Sections found: ${sections.length}`);
    sections.forEach((section: any, index: number) => {
      console.log(`[WasparfumKruidvatPage] 🧩 Section ${index + 1}:`, {
        layout: section.acf_fc_layout,
        title: section.title || section.section_title,
        productsCount: section.products?.length || 0
      });
    });

    // Transform product sections - products are already included as full objects
    const productSections = sections;

    return (
      <main className="min-h-screen bg-[#F8F6F0]">
        {/* Page Header */}
        <section className="relative py-20 bg-gradient-to-br from-[#F8F6F0] to-[#e9c356]/10 min-h-[220px] md:min-h-[400px] flex items-center">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl md:text-5xl font-bold text-[#333333] text-center mb-4">
              {page.title?.rendered || "Wasparfum Kruidvat"}
            </h1>
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="h-[2px] w-20 bg-gradient-to-r from-transparent to-[#e9c356] animate-pulse"></div>
              <div className="w-2 h-2 bg-[#e9c356] rounded-full animate-ping"></div>
              <div className="h-[2px] w-20 bg-gradient-to-l from-transparent to-[#e9c356] animate-pulse"></div>
            </div>
            <p className="text-center text-[#814E1E] max-w-3xl mx-auto text-lg">
              Ontdek het verschil tussen Wasgeurtje en wasparfum Kruidvat
            </p>
          </div>
        </section>

        {/* Render ACF Page Builder Sections */}
        {productSections.map((section: any, index: number) => {
          const layout = section.acf_fc_layout;

          switch (layout) {
            case "text_content":
              return (
                <TextContent
                  key={`text-${index}`}
                  title={section.title}
                  content={section.content}
                  backgroundColor={section.background_color || "#FFFFFF"}
                  textColor={section.text_color || "#333333"}
                  backgroundImage={section.background?.url || (typeof section.background === 'string' ? section.background : undefined)}
                  minHeight={section.min_height}
                  overlay={section.ovelay}
                />
              );

            case "image_text_block":
              return (
                <ImageTextBlock
                  key={`image-text-${index}`}
                  title={section.title}
                  content={section.content}
                  image={section.image}
                  list={section.list}
                  extraContent={section.extra_content}
                  imagePosition={section.image_position || "left"}
                  backgroundColor={section.background_color}
                  textColor={section.text_color}
                />
              );

            case "product":
              console.log('Rendering ProductShowcase:', section.section_title, 'Products:', section.products?.length || 0);
              return (
                <ProductShowcase
                  key={`products-${index}`}
                  sectionTitle={section.section_title || "Onze Producten"}
                  products={section.products || []}
                />
              );

            default:
              console.warn(`Unknown layout type: ${layout}`);
              return null;
          }
        })}
      </main>
    );
  } catch (error) {
    console.error("❌❌❌ [WasparfumKruidvatPage] CRITICAL ERROR loading page");
    console.error("❌ Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    return (
      <main className="min-h-screen bg-[#F8F6F0]">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold text-center text-red-600">
            Er is een fout opgetreden bij het laden van de pagina
          </h1>
        </div>
      </main>
    );
  }
}

