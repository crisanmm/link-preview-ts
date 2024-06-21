import fetch from 'cross-fetch';
import { DOMParser } from 'linkedom';
import { HTMLDocument } from 'linkedom/types/html/document';

export const parsePreviewDataFromUrl = async (url: string) => {
  const response = await fetch(url);
  const responseHtml = await response.text();

  const structuredDataParser = new StructuredDataHtmlParser({ html: responseHtml });
  const parsedData = structuredDataParser.parse();

  return {
    url: response.url,
    ...parsedData,
  };
};

export const parsePreviewDataFromHtml = (html: string) => {
  const structuredDataParser = new StructuredDataHtmlParser({ html });
  const parsedData = structuredDataParser.parse();

  return parsedData;
};

class StructuredDataHtmlParser {
  private document: HTMLDocument;

  public constructor({ html }: { html: string }) {
    this.document = new DOMParser().parseFromString(html, 'text/html');
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
