import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DistrictWeatherPage } from "@/components/district/DistrictWeatherPage";
import { getAllDistricts, getDistrictBySlug } from "@/lib/districts";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { districtGeoMeta, districtStructuredData } from "@/lib/seo/structured-data";
import {
  districtFaqStructuredData,
  districtSearchDescription,
  districtSearchTitle,
} from "@/lib/seo/district-content";
import { DistrictReference } from "@/components/district/DistrictReference";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const district = getDistrictBySlug(slug.toLowerCase());

  if (!district) {
    return { title: "District not found | Uganda Weather" };
  }

  const title = districtSearchTitle(district);
  const description = districtSearchDescription(district);

  return {
    ...buildPageMetadata({
      title,
      description,
      path: `/district/${district.slug}`,
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

export default async function DistrictPage({ params }: PageProps) {
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
          __html: JSON.stringify(districtStructuredData(district)),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(districtFaqStructuredData(district)),
        }}
      />
      <DistrictWeatherPage
        slug={district.slug}
        reference={<DistrictReference district={district} />}
      />
    </>
  );
}
