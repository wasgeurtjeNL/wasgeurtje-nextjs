import { Metadata } from "next";
import TextContent from "@/components/sections/TextContent";
import ContactSection from "@/components/sections/ContactSection";
import { fetchPage, extractSEOData } from "@/utils/wordpress-api";

// Generate metadata for SEO
export async function generateMetadata(): Promise<Metadata> {
  try {
    const page = await fetchPage("contact");
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
      title: "Contact - Wasgeurtje",
      description: "Neem contact op met Wasgeurtje",
    };
  }
}

export default async function ContactPage() {
  try {
    // Fetch contact page data from WordPress
    const page = await fetchPage("contact");

    if (!page) {
      return (
        <main className="min-h-screen bg-[#F8F6F0]">
          <div className="container mx-auto px-4 py-16">
            <h1 className="text-4xl font-bold text-center">
              Contact - Pagina niet gevonden
            </h1>
          </div>
        </main>
      );
    }

    // Extract ACF page_builder sections
    const sections = page.acf?.page_builder || [];

    return (
      <main className="min-h-screen bg-[#F8F6F0]">
        {/* Page Header */}
        <section className="relative py-20 bg-gradient-to-br from-[#F8F6F0] to-[#e9c356]/10 min-h-[220px] md:min-h-[300px] flex items-center">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl md:text-5xl font-bold text-[#333333] text-center mb-4">
              {page.title?.rendered || "Contact"}
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-[2px] w-20 bg-gradient-to-r from-transparent to-[#e9c356] animate-pulse"></div>
              <div className="w-2 h-2 bg-[#e9c356] rounded-full animate-ping"></div>
              <div className="h-[2px] w-20 bg-gradient-to-l from-transparent to-[#e9c356] animate-pulse"></div>
            </div>
          </div>
        </section>

        {/* Render ACF Page Builder Sections */}
        {sections.map((section: any, index: number) => {
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
                  backgroundImage={section.background?.url}
                  minHeight={section.min_height}
                  overlay={section.ovelay}
                />
              );

            case "contact":
              return (
                <ContactSection
                  key={`contact-${index}`}
                  image={section.map?.url}
                  googleMap={section.google_map}
                  contactFormShortcode={section.contact_from_shortcode}
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
    console.error("Error loading contact page:", error);
    return (
      <main className="min-h-screen bg-[#F8F6F0]">
        <div className="container mx-auto px-4 py-16">
          <h1 className="text-4xl font-bold text-center text-red-600">
            Er is een fout opgetreden bij het laden van de contact pagina
          </h1>
        </div>
      </main>
    );
  }
}

