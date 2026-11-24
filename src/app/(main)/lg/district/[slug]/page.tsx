import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DistrictReference } from "@/components/district/DistrictReference";
import { DistrictWeatherPage } from "@/components/district/DistrictWeatherPage";
import { getAllDistricts, getDistrictBySlug } from "@/lib/districts";
import { districtFaqStructuredData, districtSearchDescriptionLg } from "@/lib/seo/district-content";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { districtGeoMeta, districtStructuredData } from "@/lib/seo/structured-data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const district = getDistrictBySlug(slug.toLowerCase());

  if (!district) {
    return { title: "Disitulikiti terabise | Uganda Weather" };
  }

  const title = `Embeera y'obudde e ${district.name}`;
  const description = districtSearchDescriptionLg(district);

  return {
    ...buildPageMetadata({
      title,
      description,
      path: `/lg/district/${district.slug}`,
      locale: "lg",
      languagePaths: {
        en: `/district/${district.slug}`,
        lg: `/lg/district/${district.slug}`,
      },
    }),
    other: districtGeoMeta(district),
  };
}

export function generateStaticParams() {
  return getAllDistricts().map((district) => ({ slug: district.slug }));
}

export default async function LugandaDistrictPage({ params }: PageProps) {
  const { slug } = await params;
  const district = getDistrictBySlug(slug.toLowerCase());

  if (!district) {
    notFound();
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(districtStructuredData(district, "lg")),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(districtFaqStructuredData(district, "lg")),
        }}
      />
      <DistrictWeatherPage
        slug={district.slug}
        reference={<DistrictReference district={district} locale="lg" />}
      />
    </>
  );
}
