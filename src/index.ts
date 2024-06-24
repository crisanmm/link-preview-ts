import fetch from 'cross-fetch';
import { parseHTML } from 'linkedom';
import striptags from 'striptags';

class StructuredDataHtmlParser {
  private parseResult: ReturnType<typeof parseHTML>;
  private url?: string;

  public constructor({ html, url }: { html: string; url?: string }) {
    this.parseResult = parseHTML(html);
    this.url = url;
  }

  private getJsonLd({ type }: { type: string }): Record<string, any> | undefined {
    return Array.from(
      this.parseResult.document.querySelectorAll('script[type="application/ld+json"]')
    )
      .map((scriptElement) => {
        if (!scriptElement.textContent) {
          return;
        }

        try {
          return JSON.parse(scriptElement.textContent);
        } catch (e) {}
      })
      .flat(Infinity)
      .filter((parsedJsonLd) => {
        return parsedJsonLd?.['@type']?.toLowerCase() === type.toLowerCase();
      })?.[0];
  }

  private getUrlString(): string | undefined {
    if (this.url) {
      return this.url;
    }

    const canonicalUrl =
      this.parseResult.document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
    if (canonicalUrl) {
      return canonicalUrl;
    }
  }

  private parseName(): string | undefined {
    const name =
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="og:title"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[name="twitter:title"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="twitter:title"]')
        ?.getAttribute('content') ??
      this.getJsonLd({
        type: 'Product',
      })?.name ??
      this.parseResult.document.title;

    if (name) {
      return striptags(name).trim();
    }
  }

  private parseImages(): string[] {
    /**
     * Handle amazon product pages in a special manner since they're popular
     * but don't follow the usual meta tags for images
     */
    try {
      // TODO: include other amazon regional domains
      if (this.url && ['www.amazon.com'].includes(new URL(this.url).hostname)) {
        const scriptElement = this.parseResult.document.querySelector<HTMLScriptElement>(
          'script[data-a-state*="desktop-landing-image-data"]'
        );
        if (scriptElement?.textContent) {
          const data = JSON.parse(scriptElement.textContent);
          if (typeof data.landingImageUrl === 'string' && new URL(data.landingImageUrl)) {
            return [data.landingImageUrl];
          }
        }
      }
    } catch (e) {}

    const imageMetaTags = [
      this.parseResult.document.querySelectorAll<HTMLMetaElement>(
        'meta[property="og:image:secure_url"]'
      ),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>(
        'meta[name="og:image:secure_url"]'
      ),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('meta[property="og:image:url"]'),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('meta[name="og:image:url"]'),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('meta[property="og:image"]'),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('meta[name="og:image"]'),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>(
        'meta[property="twitter:image:src"]'
      ),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('meta[name="twitter:image:src"]'),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>(
        'meta[property="twitter:image:src"]'
      ),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('meta[name="twitter:image:src"]'),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('meta[property="twitter:image"]'),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('meta[name="twitter:image"]'),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('meta[itemprop="image"]'),
    ]
      .map((nodeList) => Array.from(nodeList))
      .flat(Infinity)
      .map((metatag) => (metatag as any)?.getAttribute?.('content') as string | undefined);

    const jsonLdProductImages = this.getJsonLd({
      type: 'Product',
    })?.image;

    const images = [
      ...imageMetaTags,
      ...(Array.isArray(jsonLdProductImages) ? jsonLdProductImages : []),
    ]
      .filter((content): content is string => typeof content === 'string')
      .map((string) => {
        if (string.startsWith('//')) {
          /**
           * URL is protocol-relative URL, add the current page's protocol
           */

          const urlString = this.getUrlString();
          const protocol = urlString
            ? new URL(urlString).protocol
            : /**
               * assume `https:`
               */
              'https:';

          return `${protocol}${string}`;
        }

        return string;
      })
      .filter((string) => {
        /**
         * Filter out invalid URLs
         */
        try {
          new URL(string);
          return true;
        } catch (e) {
          return false;
        }
      });

    return [...new Set(images)];
  }

  private parseFavicons(): string[] {
    const faviconLinkTags = [
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('link[rel="icon"]'),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('link[rel="shortcut icon"]'),
      this.parseResult.document.querySelectorAll<HTMLMetaElement>('link[rel="apple-touch-icon"]'),
    ]
      .map((nodeList) => Array.from(nodeList))
      .flat(Infinity)
      .map((metatag) => (metatag as any)?.getAttribute?.('href') as string | undefined);

    return faviconLinkTags
      .filter((content): content is string => typeof content === 'string')
      .map((content) => {
        if (content.startsWith('/') && !content.startsWith('//')) {
          /**
           * URL is relative
           */

          const urlString = this.getUrlString();
          if (!urlString) {
            /**
             * If URL is not available, return the relative URL as is
             */
            return content;
          }

          try {
            const origin = new URL(urlString).origin;
            return new URL(content, origin).href;
          } catch (e) {
            /**
             * If URL parsing fails, return the relative URL as is
             */
            return content;
          }
        }

        return content;
      })
      .filter((string) => {
        /**
         * Filter out invalid URLs
         */
        try {
          new URL(string);
          return true;
        } catch (e) {
          return false;
        }
      });
  }

  private parseDescription(): string | undefined {
    const description =
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[name="description"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="og:description"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[name="twitter:description"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="twitter:description"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[name="description"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[itemprop="description"]')
        ?.getAttribute('content') ??
      this.getJsonLd({ type: 'Product' })?.description;

    if (description) {
      return striptags(description).trim();
    }
  }

  private parsePriceAmount(): number | undefined {
    let priceAmount: string | undefined =
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="og:price:amount"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLImageElement>('meta[property="product:price:amount"]')
        ?.getAttribute('content') ??
      this.getJsonLd({ type: 'Product' })?.offers?.price ??
      this.getJsonLd({ type: 'Product' })?.offers?.lowPrice ??
      this.getJsonLd({ type: 'Product' })?.offers?.[0]?.price;

    if (typeof priceAmount === 'number') {
      return priceAmount;
    }

    if (typeof priceAmount === 'string') {
      if (priceAmount.includes(',') && priceAmount.includes('.')) {
        priceAmount = priceAmount.replace(',', '');
        return Number.parseFloat(priceAmount);
      }

      return Number.parseFloat(priceAmount);
    }

    return undefined;
  }

  private parsePriceCurrency(): string | undefined {
    const priceCurrency =
      this.parseResult.document.querySelector<HTMLMetaElement>(
        'meta[property="og:price:currency"]'
      )?.['content'] ??
      this.parseResult.document.querySelector<HTMLMetaElement>(
        'meta[property="product:price:currency"]'
      )?.['content'] ??
      this.getJsonLd({ type: 'Product' })?.offers?.priceCurrency ??
      this.getJsonLd({ type: 'Product' })?.offers?.[0]?.priceCurrency;

    if (priceCurrency) {
      return priceCurrency;
    }
  }

  private parseSiteName(): string | undefined {
    const siteName =
      this.parseResult.document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.[
        'content'
      ] ?? this.getJsonLd({ type: 'WebSite' })?.name;

    if (siteName) {
      return siteName;
    }
  }

  public parse() {
    /**
     * TODO:
     *
     * in react-native, for certain URLs it returns undefined for all object properties, e.g.:
     * - https://www.afastores.com/four-hands-lunas-drum-coffee-table.html?cmp=quartile&kw=four-hands-lunas-drum-coffee-table
     * maybe something is wrong with linkedom on hermes js engine?
     */
    return {
      name: isolateError(() => this.parseName()),
      description: isolateError(() => this.parseDescription()),
      images: isolateError(() => this.parseImages()),
      favicons: isolateError(() => this.parseFavicons()),
      priceAmount: isolateError(() => this.parsePriceAmount()),
      priceCurrency: isolateError(() => this.parsePriceCurrency()),
      siteName: isolateError(() => this.parseSiteName()),
    };
  }
}

/**
 * Due to unexpected data in the wild certain parsing logic may fail and throw.
 * Instead of crashing the entire process, isolate the error for a particular field and return undefined.
 */
const isolateError = (fn: () => any) => {
  try {
    return fn();
  } catch (e) {
    // TODO: implement this env flag
    if (process.env.LINK_PREVIEW_TS__BUNDLED !== 'true') {
      console.log(`🚀  -> isolateError  -> e:`, e);
    }
    return undefined;
  }
};

export const parsePreviewDataFromUrl = async (
  url: string,
  options?: {
    headers?: Record<string, string>;
  }
): Promise<
  {
    /**
     * Final URL, with redirects taken into account.
     */
    url: string;
  } & ReturnType<typeof parsePreviewDataFromHtml>
> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...options?.headers,
    },
  });
  const responseHtml = await response.text();

  const structuredDataParser = new StructuredDataHtmlParser({
    html: responseHtml,
    url,
  });
  const parsedData = structuredDataParser.parse();

  return {
    url: response.url,
    ...parsedData,
  };
};

export const parsePreviewDataFromHtml = (
  html: string
): ReturnType<StructuredDataHtmlParser['parse']> => {
  const structuredDataParser = new StructuredDataHtmlParser({ html });
  const parsedData = structuredDataParser.parse();

  return parsedData;
};
