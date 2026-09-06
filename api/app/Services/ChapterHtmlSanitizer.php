<?php

namespace App\Services;

use Symfony\Component\HtmlSanitizer\HtmlSanitizer;
use Symfony\Component\HtmlSanitizer\HtmlSanitizerConfig;

class ChapterHtmlSanitizer
{
    /**
     * Create a new class instance.
     */
    public function sanitize(?string $html): string
    {
        $config = (new HtmlSanitizerConfig)
            ->allowLinkSchemes(['https', 'http', 'mailto'])
            ->allowMediaSchemes(['https', 'http'])
            ->allowRelativeLinks()->allowRelativeMedias()
            ->withMaxInputLength(2_000_000);

        foreach (['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'h4',
            'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'hr', 'mark', 'span', 'div'] as $tag) {
            $config = $config->allowElement($tag);
        }
        $config = $config->allowElement('a', ['href', 'title'])->forceAttribute('a', 'rel', 'noopener noreferrer')
            ->allowElement('img', ['src', 'alt', 'title', 'width', 'height']);

        return (new HtmlSanitizer($config))->sanitize($html ?? '');
    }
}
