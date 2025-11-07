import { notFound } from "next/navigation";
import { Metadata } from "next";
import { draftMode } from "next/headers";
import { transformFlexibleContent, extractSEOData } from '@/utils/wordpress-api';
import { ComponentRenderer } from "@/components/wordpress/ComponentRegistry";
import Footer from "@/components/sections/Footer";

interface PageProps {
  params: {
    slug: string[];
  };
}

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const { slug } = await params;
    const slugPath = slug.join("/");

    console.log(`[Metadata] 🏷️  Generating metadata for: ${slugPath}`);

    // Fetch page for metadata from WordPress API directly
    const WP_API_URL = process.env.WORDPRESS_API_URL || process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://api.wasgeurtje.nl/wp-json/wp/v2';
    console.log(`[Metadata] 📡 Fetching: ${WP_API_URL}/pages?slug=${slugPath}`);
    
    const response = await fetch(
      `${WP_API_URL}/pages?slug=${slugPath}&_fields=id,title,yoast_head_json,date,modified`,
      {
        next: { revalidate: 60 }, // Short revalidation for fresh metadata
      }
    );
    
    console.log(`[Metadata] 📥 Response: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error(`[Metadata] ❌ WordPress API error: ${response.status} for slug: ${slugPath}`);
      const errorText = await response.text();
      console.error(`[Metadata] ❌ Error response:`, errorText);
      return {
        title: "Page Not Found",
        description: "The requested page could not be found.",
      };
    }

    const pages = await response.json();
    console.log(`[Metadata] 📦 Pages received:`, Array.isArray(pages) ? `${pages.length} pages` : 'single object');
    
    const pageData = Array.isArray(pages) ? pages[0] : pages;
    
    if (!pageData) {
      console.error(`[Metadata] ❌ No page data for slug: ${slugPath}`);
      return {
        title: "Page Not Found",
        description: "The requested page could not be found.",
      };
    }
    
    console.log(`[Metadata] ✅ Metadata extracted for: ${pageData.title?.rendered || pageData.title}`);


    // Transform WordPress response to match our format
    const page = {
      id: pageData.id,
      title: pageData.title?.rendered || pageData.title || '',
      yoast_head_json: pageData.yoast_head_json || {},
      date: pageData.date,
      modified: pageData.modified,
    };
    
    const seo = extractSEOData(page);

    return {
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords,
      authors: seo.author ? [{ name: seo.author }] : [{ name: "Wasgeurtje" }],
      creator: seo.author || "Wasgeurtje",
      publisher: "Wasgeurtje",
      robots: {
        index: seo.robots.index,
        follow: seo.robots.follow,
        googleBot: seo.robots.googleBot,
      },
      openGraph: {
        title: seo.ogTitle,
        description: seo.ogDescription,
        url: seo.ogUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/${slugPath}`,
        siteName: seo.ogSiteName,
        images: seo.ogImage
          ? [
              {
                url: seo.ogImage,
                width: 1200,
                height: 630,
                alt: seo.ogTitle,
              },
            ]
          : [],
        locale: seo.ogLocale,
        type: seo.ogType as any,
      },
      twitter: {
        card: seo.twitterCard as any,
        title: seo.twitterTitle,
        description: seo.twitterDescription,
        images: seo.twitterImage ? [seo.twitterImage] : [],
        creator: seo.twitterCreator,
        site: seo.twitterSite,
      },
      alternates: {
        canonical:
          seo.canonical || `${process.env.NEXT_PUBLIC_SITE_URL}/${slugPath}`,
      },
      other: {
        "schema:datePublished": seo.datePublished,
        "schema:dateModified": seo.dateModified,
        "schema:inLanguage": seo.inLanguage,
      },
    };
  } catch (error) {
    console.error("❌❌❌ [Metadata] CRITICAL ERROR generating metadata:", error);
    console.error("❌ Metadata error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
    });
    return {
      title: "Page Not Found",
      description: "The requested page could not be found.",
    };
  }
}

const cleanHTMLContent = (html: any) => {
  if (!html) return "";
  return (
    html
      // Remove style tags and their content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      // Remove inline style attributes
      .replace(/ style="[^"]*"/g, "")
      // Remove class attributes that might conflict
      .replace(/ class="[^"]*"/g, "")
      // Remove any remaining CSS text that might be in paragraphs
      .replace(/<p>style&gt;[\s\S]*?<\/p>/gi, "")
      // Remove any body, style tag remnants
      .replace(/body\s*{[\s\S]*?}/g, "")
      .replace(/\.container[\s\S]*?}/g, "")
      .replace(/h1[\s\S]*?}/g, "")
      .replace(/h2[\s\S]*?}/g, "")
      .replace(/p[\s\S]*?}/g, "")
      .replace(/\.artikel[\s\S]*?}/g, "")
      .replace(/\.clausule[\s\S]*?}/g, "")
      .replace(/\.definitie[\s\S]*?}/g, "")
  );
};

// Invalid slugs that should not be rendered (exact matches or starts with)
const INVALID_SLUGS = ['wp-login.php', 'wp-admin', 'xmlrpc.php', 'wp-config.php', '.env', 'phpmyadmin'];

export default async function DynamicPage({ params }: PageProps) {
  try {
    const { slug } = await params;
    const slugPath = slug.join("/");
    
    console.log(`[DynamicPage] 🚀 Loading page: ${slugPath}`);
    
    // Block WordPress core files and suspicious paths (exact match or starts with)
    if (slug.length > 0 && slug[0]) {
      const firstSlug = String(slug[0]).toLowerCase();
      if (INVALID_SLUGS.some(invalid => firstSlug === invalid || firstSlug.startsWith(invalid))) {
        console.log(`[DynamicPage] ❌ Blocked invalid slug: ${slugPath}`);
        notFound();
      }
    }
    
    // Cache busting: Force fresh fetch after deployment

    // Fetch page directly from WordPress API instead of through internal API route
    // This avoids dependency on NEXT_PUBLIC_SITE_URL being set correctly
    const WP_API_URL = process.env.WORDPRESS_API_URL || process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://api.wasgeurtje.nl/wp-json/wp/v2';
    
    console.log(`[DynamicPage] 📡 Fetching from API: ${WP_API_URL}/pages?slug=${slugPath}`);
    
    const response = await fetch(
      `${WP_API_URL}/pages?slug=${slugPath}&acf_format=standard&_fields=id,title,content,excerpt,slug,date,modified,status,featured_media,acf,yoast_head_json`,
      {
        next: { revalidate: 60 }, // Short revalidation for fresh content
      }
    );

    console.log(`[DynamicPage] 📥 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[DynamicPage] ❌ WordPress API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`[DynamicPage] ❌ Error response body:`, errorText);
      notFound();
    }

    const pages = await response.json();
    console.log(`[DynamicPage] 📦 Pages received:`, Array.isArray(pages) ? `${pages.length} pages` : 'single object');
    
    if (Array.isArray(pages) && pages.length > 0) {
      console.log(`[DynamicPage] 📄 First page data:`, {
        id: pages[0]?.id,
        title: pages[0]?.title?.rendered || pages[0]?.title,
        slug: pages[0]?.slug,
        has_acf: !!pages[0]?.acf,
        has_page_builder: !!pages[0]?.acf?.page_builder,
        page_builder_count: pages[0]?.acf?.page_builder?.length || 0
      });
    }
    
    // WordPress API returns an array when querying by slug
    const pageData = Array.isArray(pages) ? pages[0] : pages;

    if (!pageData) {
      console.error(`[DynamicPage] ❌ No page data found for slug: ${slugPath}`);
      notFound();
    }

    console.log(`[DynamicPage] 🔄 Transforming page data...`);

    // Transform WordPress response to match our format
    const page = {
      id: pageData.id,
      title: pageData.title?.rendered || pageData.title || '',
      content: pageData.content?.rendered || pageData.content || '',
      excerpt: pageData.excerpt?.rendered || pageData.excerpt || '',
      og_image: pageData.yoast_head_json?.og_image?.[0]?.url || '',
      acf: pageData.acf || {},
      yoast_head_json: pageData.yoast_head_json || {},
      date: pageData.date,
      modified: pageData.modified,
    };
    
    console.log(`[DynamicPage] ✅ Page transformed successfully:`, {
      title: page.title,
      hasContent: !!page.content,
      contentLength: page.content?.length || 0,
      hasACF: !!page.acf,
      acfKeys: Object.keys(page.acf || {}),
    });

    // Transform ACF flexible content to components
    // The field name is 'page_builder' as seen in WordPress ACF setup
    console.log(`[DynamicPage] 🧩 Checking for ACF page_builder...`);
    const components = page.acf?.page_builder
      ? transformFlexibleContent(page.acf.page_builder)
      : [];

    console.log(`[DynamicPage] 🎨 Components generated:`, {
      count: components.length,
      types: components.map(c => c.component)
    });

    // If no ACF content, render the standard content
    const hasACFContent = components.length > 0;
    console.log(`[DynamicPage] 📋 Rendering mode:`, hasACFContent ? 'ACF Components' : 'Standard Content');
    
    const seoData = extractSEOData(page);

    // Create structured data for the page
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": seoData.ogUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/${slugPath}`,
      url: seoData.ogUrl || `${process.env.NEXT_PUBLIC_SITE_URL}/${slugPath}`,
      name: seoData.title,
      description: seoData.description,
      isPartOf: {
        "@id": `${process.env.NEXT_PUBLIC_SITE_URL}/#website`,
      },
      datePublished: seoData.datePublished,
      dateModified: seoData.dateModified,
      inLanguage: seoData.inLanguage,
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: process.env.NEXT_PUBLIC_SITE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: seoData.title,
          },
        ],
      },
    };

    return (
      <>
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />

        <main className="min-h-screen bg-[#F8F6F0]">
          {/* Page Header - only show if no hero section in components */}
          {!hasACFContent ||
          !components.some((c) => c.component === "HeroSection") ? (
            <section
              className="relative py-20 bg-cover bg-center bg-no-repeat min-h-[220px] md:min-h-[400px] flex items-center"
              style={{
                backgroundImage: `url(${page?.og_image})`,
              }}>
              <div className="container mx-auto px-4">
                {/* max-w-4xl mx-auto */}
                <div className="">
                  <h1
                    className="text-2xl md:text-5xl mb-6 text-[#333333] text-left"
                    dangerouslySetInnerHTML={{ __html: page.title }}
                  />
                  {/* {page.title} */}

                  {/* {page.excerpt && (
                    <div
                      className="text-xl text-[#814E1E]"
                      dangerouslySetInnerHTML={{ __html: page.excerpt }}
                    />
                  )} */}
                </div>
              </div>
            </section>
          ) : null}

          {/* ACF Flexible Content */}
          {hasACFContent ? (
            <ComponentRenderer components={components} />
          ) : (
            /* Standard WordPress Content with semantic HTML */
            <>
              {/* <nav aria-label="Breadcrumb" className="py-4 px-4">
                <div className="container mx-auto">
                  <ol className="flex items-center space-x-2 text-sm text-[#2D5016]">
                    <li>
                      <a href="/" className="hover:underline">
                        Home
                      </a>
                    </li>
                    <li>/</li>
                    <li className="opacity-70">{seoData.title}</li>
                  </ol>
                </div>
              </nav> */}

              <article className="py-8 px-4">
                <div className="container mx-auto">
                  <div className="max-w-4xl mx-auto">
                    <header className="mb-8">
                      <h1 className="text-3xl md:text-4xl font-bold mb-4 text-[#030303]">
                        {seoData.title}
                      </h1>
                      {seoData.datePublished && (
                        <div className="flex items-center gap-4 text-sm text-[#030303]">
                          <time dateTime={seoData.datePublished}>
                            Gepubliceerd:{" "}
                            {new Date(seoData.datePublished).toLocaleDateString(
                              "nl-NL"
                            )}
                          </time>
                          {seoData.dateModified &&
                            seoData.dateModified !== seoData.datePublished && (
                              <time dateTime={seoData.dateModified}>
                                Gewijzigd:{" "}
                                {new Date(
                                  seoData.dateModified
                                ).toLocaleDateString("nl-NL")}
                              </time>
                            )}
                        </div>
                      )}
                    </header>

                    <section
                      className="prose prose-lg max-w-none
                      prose-headings:text-[#2D5016]
                      prose-headings:font-bold
                      prose-h1:text-4xl
                      prose-h2:text-3xl
                      prose-h3:text-2xl
                      prose-h4:text-xl
                      prose-p:text-gray-800
                      prose-p:leading-relaxed
                      prose-p:mb-4
                      prose-a:text-[#2D5016]
                      prose-a:hover:text-[#1a3009]
                      prose-a:underline
                      prose-strong:text-[#2D5016]
                      prose-strong:font-semibold
                      prose-ul:text-gray-800
                      prose-ul:list-disc
                      prose-ul:pl-6
                      prose-ol:text-gray-800
                      prose-ol:list-decimal
                      prose-ol:pl-6
                      prose-li:mb-2
                      prose-blockquote:border-l-4
                      prose-blockquote:border-[#2D5016]
                      prose-blockquote:pl-4
                      prose-blockquote:text-gray-700
                      prose-blockquote:italic
                      prose-img:rounded-lg
                      prose-img:shadow-md
                      prose-img:mx-auto
                      prose-table:w-full
                      prose-table:border-collapse
                      prose-th:bg-[#2D5016]
                      prose-th:text-white
                      prose-th:p-3
                      prose-th:text-left
                      prose-td:border
                      prose-td:border-gray-300
                      prose-td:p-3
                      prose-td:text-gray-800
                      text-black
                      custom-prose
                      "
                      dangerouslySetInnerHTML={{
                        __html: cleanHTMLContent(page.content),
                      }}
                    />
                  </div>
                </div>
              </article>
            </>
          )}

          {/* <Footer /> */}
        </main>
      </>
    );
  } catch (error) {
    console.error("❌❌❌ [DynamicPage] CRITICAL ERROR loading page:", error);
    console.error("❌ Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace',
    });
    notFound();
  }
}

// Invalid slugs that should not be generated at build time (exact matches or starts with)
const INVALID_SLUGS_FILTER = ['wp-login', 'wp-admin', 'xmlrpc', 'wp-config', '.env', 'phpmyadmin'];

// Generate static params for known pages
export async function generateStaticParams() {
  try {
    const WP_API_URL = process.env.WORDPRESS_API_URL || process.env.NEXT_PUBLIC_WORDPRESS_API_URL || 'https://api.wasgeurtje.nl/wp-json/wp/v2';
    
    console.log('[generateStaticParams] Fetching all WordPress pages...');
    
    const res = await fetch(
      `${WP_API_URL}/pages?per_page=100&_fields=slug`,
      { 
        next: { revalidate: 3600 }, // Revalidate every hour
        cache: 'default'
      }
    );

    if (!res.ok) {
      console.error('[generateStaticParams] Failed to fetch pages:', res.status);
      return [];
    }

    const pages = await res.json();
    console.log(`[generateStaticParams] Found ${pages.length} pages`);

    // Filter out invalid slugs with safe checks
    return pages
      .filter((page: any) => {
        // Safe slug extraction
        const slugValue = String(page?.slug || '').toLowerCase();
        if (!slugValue) return true; // Allow empty/undefined slugs
        
        // Exclude WordPress core files (exact match or starts with)
        return !INVALID_SLUGS_FILTER.some(
          (invalid) =>
            slugValue === invalid ||
            slugValue.startsWith(`${invalid}/`) ||
            slugValue.includes(`/${invalid}`)
        );
      })
      .map((page: any) => ({
        slug: String(page?.slug || '').split('/').filter(Boolean), // Support [...slug] catch-all
      }));
  } catch (error) {
    console.error('[generateStaticParams] Error:', error);
    return [];
  }
}

// Allow dynamic params for pages not generated at build time
export const dynamicParams = true;
