import { tool } from "ai";
import { z } from "zod";
import { app } from "~/app";
import { updateAgentStatus } from "~/lib/slack/utils";
import { SageConnectClient, type ProductSearchRequest } from "~/lib/integrations/sage-connect";
import type { ExperimentalContext } from "../respond-to-message";

// Create a singleton client instance
let sageClient: SageConnectClient | null = null;

function getSageClient(): SageConnectClient {
  if (!sageClient) {
    try {
      sageClient = SageConnectClient.fromEnvironment();
    } catch (error) {
      app.logger.error('Failed to initialize Sage Connect client:', error);
      throw new Error('Sage Connect is not configured. Please check environment variables.');
    }
  }
  return sageClient;
}

export const searchProductsTool = tool({
  name: "search_products",
  description: "Search for promotional products in the Sage Connect database. Use this for finding promotional items, merchandise, corporate gifts, or marketing materials.",
  inputSchema: z.object({
    keywords: z.string().optional().describe("Search keywords for product names or descriptions"),
    categories: z.string().optional().describe("Product categories (e.g., 'apparel', 'tech accessories', 'drinkware')"),
    colors: z.string().optional().describe("Desired colors (e.g., 'blue', 'red', 'black')"),
    themes: z.string().optional().describe("Product themes (e.g., 'eco-friendly', 'tech', 'outdoor')"),
    priceLow: z.number().positive().optional().describe("Minimum price per unit"),
    priceHigh: z.number().positive().optional().describe("Maximum price per unit"),
    qty: z.number().int().positive().optional().describe("Quantity needed"),
    verified: z.boolean().optional().describe("Only show verified products"),
    envFriendly: z.boolean().optional().describe("Only show environmentally friendly products"),
    maxResults: z.number().int().min(1).max(50).optional().default(10).describe("Maximum number of results to return"),
  }),
  execute: async (args, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      const client = getSageClient();
      
      // Build search request
      const searchRequest: ProductSearchRequest = {
        search: {
          keywords: args.keywords,
          categories: args.categories,
          colors: args.colors,
          themes: args.themes,
          priceLow: args.priceLow,
          priceHigh: args.priceHigh,
          qty: args.qty,
          verified: args.verified,
          envFriendly: args.envFriendly,
        },
        resultOptions: {
          limit: args.maxResults || 10,
        },
      };

      // Validate search request
      const validation = client.validateSearchRequest(searchRequest);
      if (!validation.isValid) {
        return [
          {
            role: "user" as const,
            content: `Invalid search request: ${validation.error}`,
          },
        ];
      }

      // Update status
      const searchTerms = [args.keywords, args.categories, args.themes].filter(Boolean).join(', ');
      await updateAgentStatus({
        channel,
        thread_ts,
        status: `is searching promotional products for "${searchTerms}"...`,
      });

      app.logger.debug("Sage Connect product search:", searchRequest);

      const results = await client.searchProducts(searchRequest);

      if (results.products.length === 0) {
        return [
          {
            role: "user" as const,
            content: `No promotional products found matching your criteria. Try broadening your search terms or adjusting price ranges.`,
          },
        ];
      }

      // Build Block Kit message for search results
      const blocks = [];
      
      // Header
      const priceRange = args.priceLow || args.priceHigh 
        ? ` in $${args.priceLow || 0}-${args.priceHigh || '∞'} range`
        : '';
        
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Found ${results.totalFound} promotional products* ${searchTerms ? `for "${searchTerms}"` : ''}${priceRange}\n\nShowing top ${results.products.length} results:`
        }
      });

      // Product results with images
      results.products.slice(0, 10).forEach((product, index) => {
        // Handle price
        let priceDisplay = 'Price on request';
        if (product.prc) {
          if (typeof product.prc === 'string') {
            priceDisplay = `$${product.prc}`;
          } else if (typeof product.prc === 'number') {
            priceDisplay = `$${product.prc.toFixed(2)}`;
          }
        }
        
        const supplierInfo = product.supplier ? ` by ${product.supplier.coName}` : '';
        const features = [];
        if (product.verified) features.push('✓ Verified');
        if (product.envFriendly) features.push('🌱 Eco-Friendly');
        const featuresDisplay = features.length > 0 ? ` (${features.join(', ')})` : '';

        const productText = `*${index + 1}. ${product.prName}*\n*ID:* ${product.productId} | *SPC:* ${product.spc}\n*Price:* ${priceDisplay}${supplierInfo}${featuresDisplay}`;

        // Add product block with thumbnail if available
        if (product.thumbPic) {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: productText
            },
            accessory: {
              type: "image",
              image_url: product.thumbPic,
              alt_text: product.prName || 'Product'
            }
          });
        } else {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn", 
              text: productText
            }
          });
        }
      });

      // Footer
      blocks.push(
        {
          type: "divider"
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: "_To get more details about a product, use the product ID number (e.g., \"get details for product 503406121\")_"
            }
          ]
        }
      );

      // Format results with images as text for now (Block Kit may not be supported)
      const formattedResults = results.products.slice(0, 10).map((product, index) => {
        // Handle price
        let priceDisplay = 'Price on request';
        if (product.prc) {
          if (typeof product.prc === 'string') {
            priceDisplay = `$${product.prc}`;
          } else if (typeof product.prc === 'number') {
            priceDisplay = `$${product.prc.toFixed(2)}`;
          }
        }
        
        const supplierInfo = product.supplier ? ` by ${product.supplier.coName}` : '';
        const features = [];
        if (product.verified) features.push('✓ Verified');
        if (product.envFriendly) features.push('🌱 Eco-Friendly');
        const featuresDisplay = features.length > 0 ? ` (${features.join(', ')})` : '';

        // Include image URL if available
        const imageInfo = product.thumbPic ? `\n🖼️ Image: ${product.thumbPic}` : '';

        return `**${index + 1}. ${product.prName}**
- **ID:** ${product.productId} | **SPC:** ${product.spc}
- **Price:** ${priceDisplay}${supplierInfo}${featuresDisplay}${imageInfo}`;
      }).join('\n\n');

      const priceFilter = args.priceLow || args.priceHigh 
        ? ` in $${args.priceLow || 0}-${args.priceHigh || '∞'} range`
        : '';
        
      const searchSummary = `**Found ${results.totalFound} promotional products** ${searchTerms ? `for "${searchTerms}"` : ''}${priceFilter}

Showing top ${results.products.slice(0, 10).length} results:

${formattedResults}

---
*To get more details about a product, use the product ID number (e.g., "get details for product 503406121")*`;

      return [
        {
          role: "user" as const,
          content: searchSummary,
        },
      ];

    } catch (error) {
      app.logger.error("Sage Connect product search failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return [
        {
          role: "user" as const,
          content: `Product search failed: ${errorMessage}. Please try again or contact your administrator.`,
        },
      ];
    }
  },
});

export const getProductDetailTool = tool({
  name: "get_product_detail",
  description: "Get detailed information about a specific promotional product including specifications, pricing, and images. Use the numeric Product ID (prodEId) from search results, not the SPC code.",
  inputSchema: z.object({
    productId: z.string().min(1, "Product ID is required").describe("The numeric product ID (prodEId) to get details for - NOT the SPC code"),
  }),
  execute: async ({ productId }, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      const client = getSageClient();
      
      // Check if it's a SPC code (contains letters/dashes) instead of numeric prodEId
      if (!/^\d+$/.test(productId)) {
        return [
          {
            role: "user" as const,
            content: `Please use the numeric Product ID (prodEId) like "783712495", not the SPC code "${productId}". You can find the numeric ID in the search results.`,
          },
        ];
      }

      if (!client.validateProductId(productId)) {
        return [
          {
            role: "user" as const,
            content: `Invalid product ID: "${productId}". Please provide a valid numeric product ID.`,
          },
        ];
      }

      await updateAgentStatus({
        channel,
        thread_ts,
        status: `is getting details for product ${productId}...`,
      });

      app.logger.debug("Sage Connect product detail lookup:", { productId });

      const product = await client.getProductDetail(productId);
      
      // Debug log to see what we got
      app.logger.info("Product detail received:", JSON.stringify(product, null, 2));

      if (!product || !product.prName) {
        return [
          {
            role: "user" as const,
            content: `Product with ID "${productId}" not found. Please check the product ID and try again.`,
          },
        ];
      }

      // Format detailed product information
      // Handle price - it might come as a string or number from the API
      let priceDisplay = 'Price on request';
      if (product.prc) {
        if (typeof product.prc === 'string') {
          priceDisplay = `$${product.prc}`; // Already formatted as range
        } else if (typeof product.prc === 'number') {
          priceDisplay = `$${product.prc.toFixed(2)}`;
        }
      }
      const supplierInfo = product.supplier ? `**Supplier:** ${product.supplier.coName} (ID: ${product.supplier.coId})` : '';
      
      const features = [];
      if (product.verified) features.push('✓ Verified Product');
      if (product.envFriendly) features.push('🌱 Eco-Friendly');
      const featuresDisplay = features.length > 0 ? `\n**Features:** ${features.join(', ')}` : '';

      // Handle colors - can be string or array
      let colors = '';
      if (product.colors) {
        if (typeof product.colors === 'string') {
          colors = `**Available Colors:** ${product.colors}`;
        } else if (Array.isArray(product.colors) && product.colors.length > 0) {
          colors = `**Available Colors:** ${product.colors.join(', ')}`;
        }
      }
      
      // Handle themes - can be string or array
      let themes = '';
      if (product.themes) {
        if (typeof product.themes === 'string') {
          themes = `**Themes:** ${product.themes}`;
        } else if (Array.isArray(product.themes) && product.themes.length > 0) {
          themes = `**Themes:** ${product.themes.join(', ')}`;
        }
      }
      const description = product.description ? `**Description:**\n${product.description}` : '';
      
      // Additional product specs from API
      const specifications = [
        product.keywords ? `**Keywords:** ${product.keywords}` : '',
        product.productCompliance ? `**Compliance:** ${product.productCompliance}` : '',
        product.comment ? `**Comments:** ${product.comment}` : '',
      ].filter(Boolean).join('\n');

      // Handle base pricing - Service 105 returns qty and prc as separate arrays
      let pricing = '';
      if (product.qty && product.prc && Array.isArray(product.qty) && Array.isArray(product.prc)) {
        const priceLines = product.qty.map((qty, index) => {
          const price = product.prc[index];
          const priceStr = price ? `$${price}` : 'Contact for pricing';
          return `• ${qty}+ units: *${priceStr}* each`;
        });
        pricing = `*Base Quantity Pricing:*\n${priceLines.join('\n')}`;
      }

      // Handle options (imprint methods, delivery, etc.)
      let optionsText = '';
      if (product.options && Array.isArray(product.options)) {
        const optionSections = product.options.map(option => {
          const optionLines = option.values.map(value => {
            const firstPrice = value.prc && value.prc[0] ? `$${value.prc[0]}` : 'Contact for pricing';
            return `  • ${value.value}: ${firstPrice}`;
          }).slice(0, 3); // Limit to first 3 options to save space
          
          return `*${option.name} Options:*\n${optionLines.join('\n')}`;
        });
        optionsText = optionSections.slice(0, 2).join('\n\n'); // Limit to 2 option types
      }

      // Handle decoration methods - Service 105 has decorationMethod (singular)
      const decorationMethods = product.decorationMethod 
        ? `**Decoration Method:** ${product.decorationMethod}`
        : product.decorationMethods?.length
        ? `**Decoration Methods:** ${product.decorationMethods.join(', ')}`
        : '';

      // Gather additional info from various fields
      const additionalInfo = [
        product.prodTime ? `**Production Time:** ${product.prodTime}` : product.leadTime ? `**Lead Time:** ${product.leadTime}` : '',
        product.weightPerCarton ? `**Weight per Carton:** ${product.weightPerCarton} lbs` : product.weight ? `**Weight:** ${product.weight}` : '',
        product.dimensions ? `**Dimensions:** ${product.dimensions}` : '',
        product.imprintArea ? `**Imprint Area:** ${product.imprintArea}` : '',
        product.priceIncludes ? `**Price Includes:** ${product.priceIncludes}` : '',
        product.package ? `**Packaging:** ${product.package}` : '',
        product.unitsPerCarton ? `**Units per Carton:** ${product.unitsPerCarton}` : '',
        product.onHand ? `**Stock Available:** ${product.onHand} units` : '',
      ].filter(Boolean).join('\n');


      // Build enhanced text format with image URLs
      const productImage = product.pics && product.pics.length > 0 
        ? product.pics.find(pic => !pic.hasLogo)?.url || product.pics[0]?.url
        : null;

      const imageSection = productImage ? `\n🖼️ **Product Image:** ${productImage}` : '';
      
      // Additional images
      const additionalImages = product.pics && product.pics.length > 1
        ? product.pics.slice(1, 4).map((pic, index) => `🖼️ Image ${index + 2}: ${pic.url}`).join('\n')
        : '';

      const productDetail = `**${product.prName || 'Product'}**${imageSection}

**Product ID:** ${product.prodEId || product.productId} | **SPC:** ${product.spc || 'N/A'}
**Category:** ${product.category || 'General'} | **Item #:** ${product.itemNum || 'N/A'}
**Base Price:** ${priceDisplay}

${supplierInfo}${featuresDisplay}

${description}

${colors}
${themes}

${pricing}
${optionsText ? `\n${optionsText}` : ''}

${decorationMethods}

${specifications}

${additionalInfo}

${additionalImages ? `\n**Additional Images:**\n${additionalImages}` : ''}

---
*Use check_inventory to see current stock levels for this product.*`;

      return [
        {
          role: "user" as const,
          content: productDetail,
        },
      ];

    } catch (error) {
      app.logger.error("Sage Connect product detail lookup failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return [
        {
          role: "user" as const,
          content: `Failed to get product details: ${errorMessage}. Please try again or check the product ID.`,
        },
      ];
    }
  },
});

export const checkInventoryTool = tool({
  name: "check_inventory",
  description: "Check real-time inventory levels and availability for a promotional product.",
  inputSchema: z.object({
    productId: z.string().min(1, "Product ID is required").describe("The product ID to check inventory for"),
  }),
  execute: async ({ productId }, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      const client = getSageClient();
      
      if (!client.validateProductId(productId)) {
        return [
          {
            role: "user" as const,
            content: `Invalid product ID: "${productId}". Please provide a valid product ID.`,
          },
        ];
      }

      await updateAgentStatus({
        channel,
        thread_ts,
        status: `is checking inventory for product ${productId}...`,
      });

      app.logger.debug("Sage Connect inventory check:", { productId });

      const inventoryResponse = await client.checkInventory(productId);

      if (!inventoryResponse.inventory || inventoryResponse.inventory.length === 0) {
        return [
          {
            role: "user" as const,
            content: `No inventory information available for product "${productId}". The product may be discontinued or not yet available.`,
          },
        ];
      }

      // Format inventory information
      const inventoryDetails = inventoryResponse.inventory.map((item, index) => {
        const availability = item.available > 0 ? `✅ ${item.available} available` : '❌ Out of stock';
        const reserved = item.reserved > 0 ? ` (${item.reserved} reserved)` : '';
        const onOrder = item.onOrder > 0 ? ` | ${item.onOrder} on order` : '';
        const expectedDate = item.expectedDate ? ` | Expected: ${item.expectedDate}` : '';
        const warehouse = item.warehouse ? ` | Warehouse: ${item.warehouse}` : '';

        return `**${item.sku}:** ${availability}${reserved}${onOrder}${expectedDate}${warehouse}`;
      }).join('\n');

      const totalAvailable = inventoryResponse.inventory.reduce((sum, item) => sum + item.available, 0);
      const totalOnOrder = inventoryResponse.inventory.reduce((sum, item) => sum + item.onOrder, 0);

      const inventorySummary = `**Inventory Status for Product ${productId}**

**Summary:**
- Total Available: ${totalAvailable} units
- Total On Order: ${totalOnOrder} units
- Last Updated: ${new Date(inventoryResponse.lastUpdated).toLocaleString()}

**Detailed Inventory:**
${inventoryDetails}

---
*Inventory levels are updated in real-time. Contact the supplier for custom quantity requirements.*`;

      return [
        {
          role: "user" as const,
          content: inventorySummary,
        },
      ];

    } catch (error) {
      app.logger.error("Sage Connect inventory check failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return [
        {
          role: "user" as const,
          content: `Failed to check inventory: ${errorMessage}. Please try again or check the product ID.`,
        },
      ];
    }
  },
});

export const getCategoriesAndThemesTool = tool({
  name: "get_categories",
  description: "Get available product categories and themes in the Sage Connect database. Useful for understanding what types of promotional products are available.",
  inputSchema: z.object({}),
  execute: async (_, { experimental_context }) => {
    try {
      const { channel, thread_ts } = experimental_context as ExperimentalContext;
      
      const client = getSageClient();

      await updateAgentStatus({
        channel,
        thread_ts,
        status: "is retrieving product categories and themes...",
      });

      app.logger.debug("Sage Connect categories lookup");

      const response = await client.getCategories();

      if (!response.categories || response.categories.length === 0) {
        return [
          {
            role: "user" as const,
            content: `No categories or themes available at this time. Please try again later.`,
          },
        ];
      }

      // Format categories (show top-level categories and a few examples)
      const topLevelCategories = response.categories
        .filter(cat => !cat.parentId)
        .slice(0, 15) // Limit to avoid overwhelming response
        .map(cat => `- ${cat.name}`)
        .join('\n');

      // Format themes
      const themes = response.themes && response.themes.length > 0
        ? response.themes
            .slice(0, 20) // Limit themes
            .map(theme => `- ${theme}`)
            .join('\n')
        : 'No specific themes available';

      const categoriesInfo = `**Available Product Categories & Themes**

**Main Product Categories:**
${topLevelCategories}
${response.categories.length > 15 ? `\n*...and ${response.categories.length - 15} more categories*` : ''}

**Popular Themes:**
${themes}
${response.themes && response.themes.length > 20 ? `\n*...and ${response.themes.length - 20} more themes*` : ''}

---
*Use these categories and themes in your product searches for better results.*`;

      return [
        {
          role: "user" as const,
          content: categoriesInfo,
        },
      ];

    } catch (error) {
      app.logger.error("Sage Connect categories lookup failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      return [
        {
          role: "user" as const,
          content: `Failed to get categories and themes: ${errorMessage}. Please try again later.`,
        },
      ];
    }
  },
});