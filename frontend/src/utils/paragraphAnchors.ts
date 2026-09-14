import type { ParagraphAnchor } from '../types/annotations';

export interface RenderedParagraph extends ParagraphAnchor {
  element: HTMLParagraphElement;
}

export function getRenderedParagraphs(container: HTMLDivElement): RenderedParagraph[] {
  return Array.from(container.querySelectorAll<HTMLParagraphElement>('p')).flatMap((element) => {
    const rawText = element.textContent ?? '';
    const selectedText = rawText.trim();
    if (!selectedText) return [];

    const precedingContent = document.createRange();
    precedingContent.selectNodeContents(container);
    precedingContent.setEndBefore(element);
    const leadingWhitespace = rawText.indexOf(selectedText);
    const startIndex = precedingContent.toString().length + Math.max(0, leadingWhitespace);

    return [{
      element,
      selectedText,
      startIndex,
      endIndex: startIndex + selectedText.length,
    }];
  });
}
