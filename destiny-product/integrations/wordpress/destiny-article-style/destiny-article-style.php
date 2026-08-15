<?php
/**
 * Plugin Name: Destiny Article Style
 * Description: Preserves the visual hierarchy of articles delivered by Destiny without changing the rest of the website.
 * Version: 0.1.0
 * Author: Destiny
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

function destiny_article_style_should_load() {
    if (!is_singular()) {
        return false;
    }

    $post = get_post();
    return $post && strpos((string) $post->post_content, 'destiny-article') !== false;
}

function destiny_article_style_enqueue() {
    if (!destiny_article_style_should_load()) {
        return;
    }

    wp_enqueue_style(
        'destiny-article-style',
        plugin_dir_url(__FILE__) . 'assets/destiny-article.css',
        array(),
        '0.1.0'
    );
}
add_action('wp_enqueue_scripts', 'destiny_article_style_enqueue', 20);

function destiny_article_style_editor_assets() {
    wp_enqueue_style(
        'destiny-article-style-editor',
        plugin_dir_url(__FILE__) . 'assets/destiny-article.css',
        array(),
        '0.1.0'
    );
}
add_action('enqueue_block_editor_assets', 'destiny_article_style_editor_assets');
