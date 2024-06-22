import fetch from 'cross-fetch';
import { parseHTML } from 'linkedom';

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
    headers: options?.headers,
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

parsePreviewDataFromUrl(
  'https://www.westelm.com/products/mp-classic-rattan-wood-buffet-60-h11181/?sku=2321348'
).then(console.log);

export const parsePreviewDataFromHtml = (
  html: string
): ReturnType<StructuredDataHtmlParser['parse']> => {
  const structuredDataParser = new StructuredDataHtmlParser({ html });
  const parsedData = structuredDataParser.parse();

  return parsedData;
};

class StructuredDataHtmlParser {
  private parseResult: ReturnType<typeof parseHTML>;
  private url?: string;

  public constructor({ html, url }: { html: string; url?: string }) {
    this.parseResult = parseHTML(html);
    this.url = url;
  }

  private parseName(): string {
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
      this.parseResult.document.title;

    return name;
  }

  private parseImages(): string[] {
    try {
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

    const image =
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="og:image:secure_url"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="og:image:url"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="og:image"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[name="twitter:image:src"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="twitter:image:src"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[name="twitter:image"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="twitter:image"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[itemprop="image"]')
        ?.getAttribute('content') ??
      this.parseResult.document.querySelector<HTMLImageElement>('article img[src]')?.src ??
      this.parseResult.document.querySelector<HTMLImageElement>('#content img[src]')?.src ??
      this.parseResult.document.querySelector<HTMLImageElement>('img[alt*="author" i]')?.src ??
      this.parseResult.document.querySelector<HTMLImageElement>(
        'img[src]:not([aria-hidden="true"])'
      )?.src;

    // TODO: use `querySelectorAll()` to get all images
    if (image) {
      return [image];
    }

    return [];
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
        ?.getAttribute('content');

    if (description) {
      return description;
    }
  }

  private parsePrice(): number | undefined {
    const price =
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="og:price:amount"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLImageElement>('meta[property="product:price:amount"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="twitter:data1"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="twitter:label1"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="twitter:data2"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLMetaElement>('meta[property="twitter:label2"]')
        ?.getAttribute('content') ??
      this.parseResult.document
        .querySelector<HTMLImageElement>('meta[property="product:price:currency"]')
        ?.getAttribute('content');

    if (price) {
      return Number.parseFloat(price);
    }

    return undefined;
  }

  private parseCurrency(): string | undefined {
    const currency =
      this.parseResult.document.querySelector<HTMLMetaElement>(
        'meta[property="product:price:currency"]'
      )?.['content'] ??
      this.parseResult.document.querySelector<HTMLMetaElement>(
        'meta[property="og:price:currency"]'
      )?.['content'];

    if (currency) {
      return currency;
    }
  }

  private parseSiteName(): string | undefined {
    const siteName = this.parseResult.document.querySelector<HTMLMetaElement>(
      'meta[property="og:site_name"]'
    )?.['content'];

    if (siteName) {
      return siteName;
    }
  }

  public parse() {
    return {
      name: this.parseName(),
      description: this.parseDescription(),
      images: this.parseImages(),
      price: this.parsePrice(),
      currency: this.parseCurrency(),
      siteName: this.parseSiteName(),
    };
  }
}
