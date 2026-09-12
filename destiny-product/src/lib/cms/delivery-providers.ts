export type CmsDeliveryProvider = {
  id: string;
  label: string;
  connected: boolean;
  draftEndpoint: string;
};

export function cmsDeliveryProviders(wordpressConnected: boolean, webflowConnected: boolean): CmsDeliveryProvider[] {
  return [
    { id: "wordpress", label: "WordPress", connected: wordpressConnected, draftEndpoint: "/api/integrations/cms/wordpress/draft" },
    { id: "webflow", label: "Webflow", connected: webflowConnected, draftEndpoint: "/api/integrations/cms/webflow/draft" },
  ];
}
