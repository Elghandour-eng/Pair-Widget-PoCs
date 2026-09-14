# Product Widgets Specification & Figma Mapping

This document specifies the technical design, UI behavior, Figma node references, and JSON response payloads for the AI Chat Widget's product-related templates:

1. **Multi-Product Carousel** (`widget_template.type: "carousel"`, `carousel_type: "products"`)
2. **Single Product Card** (`widget_template.type: "carousel"`, `carousel_type: "products"`, single item)
3. **Product Recommendation Slots** (`widget_template.type: "product_slots"`)

---

## 1. Quick Reference & Figma Links

| Widget / Component         | Variant / State               | Figma Node Link                                                                                                              |
| :------------------------- | :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| **Multi-Product Carousel** | Main Carousel View            | [Figma: 25151-539964](https://www.figma.com/design/Pqbq4cZdfr1dDVGIbGA3G7/Pair-OS?node-id=25151-539964&t=rEtPSDBLm7qWKvfD-0) |
| **Multi-Product Carousel** | "View All" Button Component   | [Figma: 25151-539378](https://www.figma.com/design/Pqbq4cZdfr1dDVGIbGA3G7/Pair-OS?node-id=25151-539378&t=rEtPSDBLm7qWKvfD-0) |
| **Single Product Card**    | Standalone Card (No Carousel) | [Figma: 25318-125950](https://www.figma.com/design/Pqbq4cZdfr1dDVGIbGA3G7/Pair-OS?node-id=25318-125950&t=rEtPSDBLm7qWKvfD-0) |
| **Product Slots**          | Default / Collapsed State     | [Figma: 25151-541384](https://www.figma.com/design/Pqbq4cZdfr1dDVGIbGA3G7/Pair-OS?node-id=25151-541384&t=rEtPSDBLm7qWKvfD-0) |
| **Product Slots**          | "See More" Expanded State     | [Figma: 25152-542100](https://www.figma.com/design/Pqbq4cZdfr1dDVGIbGA3G7/Pair-OS?node-id=25152-542100&t=rEtPSDBLm7qWKvfD-0) |

---

## 2. Multi-Product Carousel (`products` carousel)

### 2.1 UI & Layout Rules

- **Display Mode**: Horizontal scrollable carousel (`scrollable: true`, `visible_items: 2`).
- **Product Card Orientation**: Column layout (vertical orientation). Each card contains:
  - Product Image thumbnail (`product_card.show_image: true`)
  - Discount Badge if available (e.g., `30% OFF`)
  - Brand Name (e.g., `Medena Pharm`, `ACM`, `Clarins`)
  - Product Name / Title
  - Pricing (Current price and strikethrough Old price if discounted)
  - Action Button (`Add to cart`)
  - Availability status (`in_stock` / `out_of_stock`)
- **Header**:
  - Icon: `sparkles`
  - Title: Section title (e.g., `Top Moisturizers`)
  - View All Action: Enabled and visible (`view_all.visible: true`, label: `"View All"`)
- **Supplementary Text**:
  - `intro_text`: Top intro description before/inside the card (e.g., `"Here are the top moisturizers from Boutiqaat."`)
  - `description_text`: Footer/subtext (e.g., `"Suitable for daily use."`)

### 2.2 Figma References

- **Carousel Component**: [Figma Node 25151-539964](https://www.figma.com/design/Pqbq4cZdfr1dDVGIbGA3G7/Pair-OS?node-id=25151-539964&t=rEtPSDBLm7qWKvfD-0)
- **View All Button**: [Figma Node 25151-539378](https://www.figma.com/design/Pqbq4cZdfr1dDVGIbGA3G7/Pair-OS?node-id=25151-539378&t=rEtPSDBLm7qWKvfD-0)

### 2.3 Response Payload

```json
{
  "ulid": "01M2FSY1M22RRT8Z6E2S6MJTXS",
  "type": "message",
  "content": "",
  "message_type": "widget_message",
  "sender_type": "ai_agent",
  "sent_at": "2026-09-14T11:13:14.000Z",
  "status": "sent",
  "is_csat_survey": false,
  "widget_template": {
    "type": "carousel",
    "config": {
      "style": {
        "text_styles": {
          "action": {
            "color": "#1F1F1F",
            "font_size": 13,
            "font_family": "inherit",
            "font_weight": 500
          },
          "copy_code": {
            "color": "#6F6F6F",
            "font_size": 12,
            "font_family": "inherit",
            "font_weight": 500
          },
          "offer_code": {
            "color": "#0077B6",
            "font_size": 11,
            "font_family": "inherit",
            "font_weight": 600,
            "text_transform": "uppercase"
          },
          "offer_title": {
            "color": "#1F1F1F",
            "font_size": 15,
            "font_family": "inherit",
            "font_weight": 600
          },
          "section_title": {
            "color": "#1F1F1F",
            "font_size": 16,
            "font_family": "inherit",
            "font_weight": 600,
            "line_height": 22
          },
          "primary_action": {
            "color": "#FFFFFF",
            "font_size": 13,
            "font_family": "inherit",
            "font_weight": 500,
            "line_height": 18
          },
          "offer_description": {
            "color": "#555555",
            "font_size": 13,
            "font_family": "inherit",
            "font_weight": 400
          }
        }
      },
      "layout": {
        "scroll_type": "horizontal",
        "visible_items": 1,
        "show_pagination_dots": true
      },
      "carousel": {
        "scrollable": true,
        "visible_items": 2
      },
      "visibility": {
        "show_code": true,
        "show_title": true,
        "show_actions": true,
        "show_copy_code": true,
        "show_description": true
      },
      "product_card": {
        "show_image": true,
        "show_action": true
      }
    },
    "content": {
      "header": {
        "icon": "sparkles",
        "title": "Top Moisturizers",
        "view_all": {
          "label": "View All",
          "visible": true
        }
      },
      "products": [
        {
          "id": "601799",
          "name": "Progress Dry Skin Filler Cream - 50ml",
          "brand": "Medena Pharm",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00010380-1.jpg",
          "price": {
            "current": 24.05,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000001",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "601799"
              }
            }
          ],
          "availability": "in_stock"
        },
        {
          "id": "594561",
          "name": "Azeane Cream - 30ml",
          "brand": "ACM",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00010073-R1-1.jpg",
          "price": {
            "old": 9.75,
            "current": 6.825,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000002",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "594561"
              }
            }
          ],
          "discount": {
            "label": "30% OFF",
            "percentage": 30
          },
          "availability": "in_stock"
        },
        {
          "id": "671115",
          "name": "Hydra Pro Glow Cream - 50ml",
          "brand": "Kiko Milano",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00012673-1.jpg",
          "price": {
            "current": 11.25,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000003",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "671115"
              }
            }
          ],
          "availability": "in_stock"
        },
        {
          "id": "680321",
          "name": "Radiance Brightening Cream - 30ml",
          "brand": "Dermaceutic",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00012791-1.jpg",
          "price": {
            "old": 29.745,
            "current": 23.796,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000004",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "680321"
              }
            }
          ],
          "discount": {
            "label": "20% OFF",
            "percentage": 20
          },
          "availability": "in_stock"
        },
        {
          "id": "562117",
          "name": "Collagen & Hya Day & Night Cream - 50ml",
          "brand": "Cathy Doll",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00009460-1.jpg",
          "price": {
            "current": 10,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000005",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "562117"
              }
            }
          ],
          "availability": "in_stock"
        },
        {
          "id": "623850",
          "name": "Multi-Active Night Cream for Dry Skin - 50ml",
          "brand": "Clarins",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00011101-1.jpg",
          "price": {
            "current": 35.5,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000006",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "623850"
              }
            }
          ],
          "availability": "out_of_stock"
        },
        {
          "id": "600712",
          "name": "Phyto A+ Brightening Treatment Daily Corrective Moisturiser for All Skin Types - 30ml",
          "brand": "SkinCeuticals",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00010291-R-1.jpg",
          "price": {
            "current": 45,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000007",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "600712"
              }
            }
          ],
          "availability": "out_of_stock"
        },
        {
          "id": "586441",
          "name": "Glow Skin Balm To Go Mist - 80ml",
          "brand": "Missha",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//M/U/MU-00015477-1.jpg",
          "price": {
            "current": 15,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000008",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "586441"
              }
            }
          ],
          "availability": "in_stock"
        },
        {
          "id": "586440",
          "name": "Glow Skin Face Balm - 50ml",
          "brand": "Missha",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//M/U/MU-00015476-R-1.jpg",
          "price": {
            "current": 12,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000009",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "586440"
              }
            }
          ],
          "availability": "in_stock"
        },
        {
          "id": "665247",
          "name": "Snail Repair Cream - 100ml",
          "brand": "Ghadeer Sultan",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00012475-1.jpg",
          "price": {
            "current": 8,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000010",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "665247"
              }
            }
          ],
          "availability": "in_stock"
        },
        {
          "id": "700949",
          "name": "Dewy Glow Mist Serum Spray - 100ml",
          "brand": "The Hoppa",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00013520-1.jpg",
          "price": {
            "old": 5.25,
            "current": 4.2,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000011",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "700949"
              }
            }
          ],
          "discount": {
            "label": "20% OFF",
            "percentage": 20
          },
          "availability": "in_stock"
        },
        {
          "id": "628757",
          "name": "Vegan Bakuchiol Comforting Cream - 80ml",
          "brand": "TINAZANA",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00011300-1.jpg",
          "price": {
            "old": 8.5,
            "current": 5.95,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000012",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "628757"
              }
            }
          ],
          "discount": {
            "label": "30% OFF",
            "percentage": 30
          },
          "availability": "in_stock"
        }
      ],
      "intro_text": "Here are the top moisturizers from Boutiqaat.",
      "description_text": "Suitable for daily use."
    },
    "carousel_type": "products"
  }
}
```

---

## 3. Single Product Card (No Carousel)

### 3.1 UI & Layout Rules

- **Display Mode**: Single standalone card (`carousel.scrollable: false`, `carousel.visible_items: 1`).
- **No Carousel Controls**: No scroll track, pagination dots, or multi-item scroll behavior.
- **Header**:
  - Icon: `sparkles`
  - Title: Section title (e.g., `Top Moisturizers`)
  - View All Action: Hidden (`view_all.visible: false`)
- **Product Card**: Contains single product with image, brand, name, price, and primary action button.

### 3.2 Figma Reference

- **Single Product Node**: [Figma Node 25318-125950](https://www.figma.com/design/Pqbq4cZdfr1dDVGIbGA3G7/Pair-OS?node-id=25318-125950&t=rEtPSDBLm7qWKvfD-0)

### 3.3 Response Payload

```json
{
  "ulid": "01M2FSYDTZQZY3TY7MC59MVZN2",
  "type": "message",
  "content": "",
  "message_type": "widget_message",
  "sender_type": "ai_agent",
  "sent_at": "2026-09-14T11:13:27.000Z",
  "status": "sent",
  "is_csat_survey": false,
  "widget_template": {
    "type": "carousel",
    "config": {
      "style": {
        "text_styles": {
          "action": {
            "color": "#1F1F1F",
            "font_size": 13,
            "font_family": "inherit",
            "font_weight": 500
          },
          "copy_code": {
            "color": "#6F6F6F",
            "font_size": 12,
            "font_family": "inherit",
            "font_weight": 500
          },
          "offer_code": {
            "color": "#0077B6",
            "font_size": 11,
            "font_family": "inherit",
            "font_weight": 600,
            "text_transform": "uppercase"
          },
          "offer_title": {
            "color": "#1F1F1F",
            "font_size": 15,
            "font_family": "inherit",
            "font_weight": 600
          },
          "section_title": {
            "color": "#1F1F1F",
            "font_size": 16,
            "font_family": "inherit",
            "font_weight": 600,
            "line_height": 22
          },
          "primary_action": {
            "color": "#FFFFFF",
            "font_size": 13,
            "font_family": "inherit",
            "font_weight": 500,
            "line_height": 18
          },
          "offer_description": {
            "color": "#555555",
            "font_size": 13,
            "font_family": "inherit",
            "font_weight": 400
          }
        }
      },
      "layout": {
        "scroll_type": "horizontal",
        "visible_items": 1,
        "show_pagination_dots": true
      },
      "carousel": {
        "scrollable": false,
        "visible_items": 1
      },
      "visibility": {
        "show_code": true,
        "show_title": true,
        "show_actions": true,
        "show_copy_code": true,
        "show_description": true
      },
      "product_card": {
        "show_image": true,
        "show_action": true
      }
    },
    "content": {
      "header": {
        "icon": "sparkles",
        "title": "Top Moisturizers",
        "view_all": {
          "label": "View All",
          "visible": false
        }
      },
      "products": [
        {
          "id": "601799",
          "name": "Progress Dry Skin Filler Cream - 50ml",
          "brand": "Medena Pharm",
          "image": "https://gamacdn.boutiqaat.com/media/catalog/product//S/C/SC-00010380-1.jpg",
          "price": {
            "current": 24.05,
            "currency": "KWD"
          },
          "actions": [
            {
              "id": "01KADDTOCARTACTION00000001",
              "type": "add_to_cart",
              "label": "Add to cart",
              "payload": {
                "product_id": "601799"
              }
            }
          ],
          "availability": "in_stock"
        }
      ],
      "intro_text": "Here is a moisturizer pick for you.",
      "description_text": "Suitable for daily use."
    },
    "carousel_type": "products"
  }
}
```

---

## 4. Product Slots Widget (`product_slots`)

### 4.1 UI & Layout Rules

- **Template Type**: `product_slots`
- **Slot Item Layout**:
  - **Header & Badges**:
    - Step Order Badge (`order: 1`, `show_order: true`)
    - Category Tag (e.g., `Cleanse`, `show_category: true`)
    - Timing Badges (e.g., `AM` / `PM` chips, `timing_badges.enabled: true`)
  - **Slot Title**: Routine step title (e.g., `Gentle Foaming Cleanser`)
  - **Description & Goal**:
    - `description`: Primary slot description (e.g., `"A refreshing start to clear and prep your skin."`)
    - `goal`: Routine step goal (e.g., `"Removes impurities while preserving moisture."`)
  - **Expandable "See More" State**:
    - When collapsed: Displays core info + recommended product card.
    - When expanded: Shows `how_to_use` instructions (e.g., `"Massage onto damp skin for 60 seconds and rinse."`) and expanded routine tips.
  - **Recommended Product Card**:
    - Embedded product recommendation with image, brand, title, current/old price, and action button (`Add` with `add_product` action type).

### 4.2 Figma References

- **Product Slots (Collapsed)**: [Figma Node 25151-541384](https://www.figma.com/design/Pqbq4cZdfr1dDVGIbGA3G7/Pair-OS?node-id=25151-541384&t=rEtPSDBLm7qWKvfD-0)
- **Product Slots ("See More" Expanded)**: [Figma Node 25152-542100](https://www.figma.com/design/Pqbq4cZdfr1dDVGIbGA3G7/Pair-OS?node-id=25152-542100&t=rEtPSDBLm7qWKvfD-0)

### 4.3 Response Payload

```json
{
  "ulid": "01M2FSYS7VFT6PF4Q32YJ2NWAX",
  "type": "message",
  "content": "",
  "message_type": "widget_message",
  "sender_type": "ai_agent",
  "sent_at": "2026-09-14T11:13:39.000Z",
  "status": "sent",
  "is_csat_survey": false,
  "widget_template": {
    "type": "product_slots",
    "config": {
      "slot": {
        "show_goal": true,
        "show_order": true,
        "show_action": true,
        "show_category": true,
        "timing_badges": {
          "enabled": true,
          "supported_values": ["AM", "PM"]
        },
        "show_how_to_use": true,
        "show_description": true,
        "show_when_to_use": true,
        "recommended_product": {
          "label": "Recommended Product",
          "show_name": true,
          "show_brand": true,
          "show_image": true,
          "show_label": true,
          "show_action": true,
          "show_discount": true,
          "show_old_price": true
        }
      }
    },
    "content": {
      "slots": [
        {
          "id": "slot_1",
          "goal": "Removes impurities while preserving moisture.",
          "order": 1,
          "title": "Gentle Foaming Cleanser",
          "category": "Cleanse",
          "how_to_use": "Massage onto damp skin for 60 seconds and rinse.",
          "description": "A refreshing start to clear and prep your skin.",
          "when_to_use": ["AM", "PM"],
          "recommended_product": {
            "id": "product_1",
            "name": "Lady Powder White Set – 3 pcs",
            "brand": "Moodi Scent",
            "image": "https://example.com/product-1.png",
            "price": {
              "old": 23.999,
              "current": 23,
              "currency": "KWD"
            },
            "actions": [
              {
                "id": "01KADDPRODUCTACTION0000001",
                "type": "add_product",
                "label": "Add",
                "payload": {
                  "slot_id": "slot_1",
                  "product_id": "product_1",
                  "source_template_type": "product_recommendation_slots"
                }
              }
            ]
          }
        }
      ]
    }
  }
}
```

---

## 5. TypeScript Interface Definitions

```typescript
export interface ProductPrice {
  old?: number
  current: number
  currency: string
}

export interface ProductDiscount {
  label: string
  percentage: number
}

export interface WidgetAction<T = Record<string, unknown>> {
  id: string
  type: 'add_to_cart' | 'add_product' | 'view_all' | string
  label: string
  payload: T
}

export interface ProductItem {
  id: string
  name: string
  brand: string
  image: string
  price: ProductPrice
  actions: WidgetAction<{ product_id: string; [key: string]: unknown }>[]
  discount?: ProductDiscount
  availability?: 'in_stock' | 'out_of_stock' | string
}

export interface ProductCarouselContent {
  header: {
    icon?: string
    title: string
    view_all?: {
      label: string
      visible: boolean
    }
  }
  products: ProductItem[]
  intro_text?: string
  description_text?: string
}

export interface ProductSlotsTimingBadgesConfig {
  enabled: boolean
  supported_values: string[]
}

export interface RecommendedProductConfig {
  label: string
  show_name: boolean
  show_brand: boolean
  show_image: boolean
  show_label: boolean
  show_action: boolean
  show_discount: boolean
  show_old_price: boolean
}

export interface SlotConfig {
  show_goal: boolean
  show_order: boolean
  show_action: boolean
  show_category: boolean
  timing_badges: ProductSlotsTimingBadgesConfig
  show_how_to_use: boolean
  show_description: boolean
  show_when_to_use: boolean
  recommended_product: RecommendedProductConfig
}

export interface SlotRecommendedProduct {
  id: string
  name: string
  brand: string
  image: string
  price: ProductPrice
  discount?: ProductDiscount
  actions: WidgetAction<{
    slot_id: string
    product_id: string
    source_template_type: string
  }>[]
}

export interface ProductSlotItem {
  id: string
  order: number
  title: string
  category: string
  goal?: string
  description?: string
  how_to_use?: string
  when_to_use?: string[] // e.g. ["AM", "PM"]
  recommended_product?: SlotRecommendedProduct
}

export interface ProductSlotsContent {
  slots: ProductSlotItem[]
}
```
