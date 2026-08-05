import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "SCALE LXP Docs",
  description: "Documentation for the SCALE LXP supply chain simulation platform",
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Architecture & Guides', link: '/guides/application-architecture' },
      { text: 'Policies & Security', link: '/policies/data-privacy-policy' },
      { text: 'API Reference', link: '/api-reference.html', target: '_blank' }
    ],
    sidebar: [
      {
        text: 'Architecture & Guides',
        items: [
          { text: 'Application Architecture', link: '/guides/application-architecture' }
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Interactive API Docs', link: '/api-reference.html', target: '_blank' }
        ]
      },
      {
        text: 'Policies & Security',
        items: [
          { text: 'Data Privacy Policy', link: '/policies/data-privacy-policy' },
          { text: 'HECVAT Security Policy', link: '/policies/hecvat-information-security-policy' }
        ]
      }
    ],
    footer: {
      message: 'SCALE LXP Platform Documentation',
      copyright: 'Copyright © 2026'
    }
  }
})
