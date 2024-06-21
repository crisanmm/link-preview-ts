import fetch from 'cross-fetch';
import { DOMParser } from 'linkedom';
import { HTMLDocument } from 'linkedom/types/html/document';

export const parsePreviewDataFromUrl = async (
  url: string
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
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0',
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

class StructuredDataHtmlParser {
  private document: HTMLDocument;
  private url?: string;

  public constructor({ html, url }: { html: string; url?: string }) {
    this.document = new DOMParser().parseFromString(html, 'text/html');
    this.url = url;
  }

  private parseName(): string {
    const name =
      this.document.head.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
      this.document.head.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ??
      this.document.head.querySelector('meta[property="twitter:title"]')?.getAttribute('content') ??
      this.document.head.title;

    return name;
  }

  private parseImages(): string[] {
    try {
      if (this.url && ['www.amazon.com'].includes(new URL(this.url).hostname)) {
        const scriptElement = this.document.querySelector(
          'script[data-a-state*="desktop-landing-image-data"]'
        );
        if (scriptElement.textContent) {
          const data = JSON.parse(scriptElement.textContent);
          if (typeof data.landingImageUrl === 'string' && new URL(data.landingImageUrl)) {
            return [data.landingImageUrl];
          }
        }
      }
    } catch (e) {}

    const image =
      this.document.head
        .querySelector('meta[property="og:image:secure_url"]')
        ?.getAttribute('content') ??
      this.document.head.querySelector('meta[property="og:image:url"]')?.getAttribute('content') ??
      this.document.head.querySelector('meta[property="og:image"]')?.getAttribute('content') ??
      this.document.head.querySelector('meta[name="twitter:image:src"]')?.getAttribute('content') ??
      this.document.head
        .querySelector('meta[property="twitter:image:src"]')
        ?.getAttribute('content') ??
      this.document.head.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ??
      this.document.head.querySelector('meta[property="twitter:image"]')?.getAttribute('content') ??
      this.document.head.querySelector('meta[itemprop="image"]')?.getAttribute('content') ??
      this.document.head.querySelector<HTMLImageElement>('article img[src]')?.src ??
      this.document.head.querySelector<HTMLImageElement>('#content img[src]')?.src ??
      this.document.head.querySelector<HTMLImageElement>('img[alt*="author" i]')?.src ??
      this.document.head.querySelector<HTMLImageElement>('img[src]:not([aria-hidden="true"])')?.src;

    // TODO: use `querySelectorAll()` to get all images
    if (image) {
      return [image];
    }

    return [];
  }

  private parseDescription(): string | undefined {
    const description =
      this.document.head.querySelector('meta[name="description"]')?.getAttribute('content') ??
      this.document.head
        .querySelector('meta[property="og:description"]')
        ?.getAttribute('content') ??
      this.document.head
        .querySelector('meta[name="twitter:description"]')
        ?.getAttribute('content') ??
      this.document.head
        .querySelector('meta[property="twitter:description"]')
        ?.getAttribute('content') ??
      this.document.head.querySelector('meta[name="description"]')?.getAttribute('content') ??
      this.document.head.querySelector('meta[itemprop="description"]')?.getAttribute('content');

    if (description) {
      return description;
    }
  }

  private parsePrice(): number | undefined {
    const price =
      this.document.head
        .querySelector<HTMLMetaElement>('meta[property="og:price:amount"]')
        ?.getAttribute('content') ??
      this.document.head
        .querySelector<HTMLMetaElement>('meta[property="product:price:amount"]')
        ?.getAttribute('content') ??
      this.document.head
        .querySelector<HTMLMetaElement>('meta[property="twitter:data1"]')
        ?.getAttribute('content') ??
      this.document.head
        .querySelector<HTMLMetaElement>('meta[property="twitter:label1"]')
        ?.getAttribute('content') ??
      this.document.head
        .querySelector<HTMLMetaElement>('meta[property="twitter:data2"]')
        ?.getAttribute('content') ??
      this.document.head
        .querySelector<HTMLMetaElement>('meta[property="twitter:label2"]')
        ?.getAttribute('content') ??
      this.document.head
        .querySelector<HTMLMetaElement>('meta[property="product:price:currency"]')
        ?.getAttribute('content');

    if (price) {
      return Number.parseFloat(price);
    }

    return undefined;
  }

  private parseCurrency(): string | undefined {
    const currency =
      this.document.head.querySelector<HTMLMetaElement>(
        'meta[property="product:price:currency"]'
      )?.['content'] ??
      this.document.head.querySelector<HTMLMetaElement>('meta[property="og:price:currency"]')?.[
        'content'
      ];

    if (currency) {
      return currency;
    }
  }

  private parseSiteName(): string | undefined {
    const siteName = this.document.head.querySelector<HTMLMetaElement>(
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
