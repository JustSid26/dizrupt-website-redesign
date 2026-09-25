/* The client banners: one wide image per project, shared by the spiral's cards and the case page.
   They are all the same shape, so the picture never stretches on the way from one to the other. */
export const BANNERS: Record<string, string> = {
  SlickFix: '/banners/slickfix.jpg',
  Alwrite: '/banners/alwrite.jpg',
  'Nykonos Entertainment': '/banners/nykonos.jpg',
  Kiaash: '/banners/kiaash.jpg',
  Furnfetch: '/banners/furnfetch.jpg',
  'KP Packaging': '/banners/kp-packaging.jpg',
  'AVG Windscreens': '/banners/avg-windscreens.jpg',
  'Samir Gems': '/banners/samir-gems.jpg',
  'Maverick Realtors': '/banners/maverick-realtors.jpg',
  Crossline: '/banners/crossline.jpg',
};

export const BANNER_ASPECT = 2574 / 894;

export const bannerFor = (title: string) => BANNERS[title] || null;
