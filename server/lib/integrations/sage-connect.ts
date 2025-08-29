
export interface SageConnectConfig {
  apiUrl: string;
  accountId: string;
  loginId: string;
  apiKey: string;
  apiVersion?: number;
}

export interface SageConnectError {
  errNum: number;
  errMsg: string;
}

export interface ProductSearchRequest {
  search: {
    keywords?: string;
    categories?: string;
    colors?: string;
    themes?: string;
    priceLow?: number;
    priceHigh?: number;
    qty?: number;
    verified?: boolean;
    envFriendly?: boolean;
  };
  resultOptions?: {
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'price' | 'name';
  };
}

export interface Product {
  productId: string;
  prodEId?: number; // The actual ID from API
  spc: string;
  prName: string;
  name?: string; // The actual name from API
  category?: string;
  prc?: string | number; // Can be a price range string like "1.73 - 2.13"
  colors?: string[];
  themes?: string[];
  supplier?: {
    coName: string;
    coId: string;
  };
  verified?: boolean;
  envFriendly?: boolean;
  thumbPic?: string; // Thumbnail image URL
}

export interface ProductSearchResponse {
  products: Product[];
  totalFound: number;
  offset: number;
  limit: number;
}

export interface ProductDetail extends Product {
  description?: string;
  specifications?: Record<string, any>;
  pricing?: Array<{
    qty: number;
    price: number;
  }>;
  decorationMethods?: string[];
  images?: string[];
  leadTime?: string;
  weight?: string;
  dimensions?: string;
}

export interface InventoryItem {
  sku: string;
  available: number;
  reserved: number;
  onOrder: number;
  expectedDate?: string;
  warehouse?: string;
}

export interface InventoryResponse {
  productId: string;
  inventory: InventoryItem[];
  lastUpdated: string;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  children?: Category[];
}

export interface CategoriesResponse {
  categories: Category[];
  themes: string[];
}

export class SageConnectClient {
  private readonly apiUrl: string;
  private readonly accountId: string;
  private readonly loginId: string;
  private readonly apiKey: string;
  private readonly apiVersion: number;

  constructor(config: SageConnectConfig) {
    this.apiUrl = config.apiUrl;
    this.accountId = config.accountId;
    this.loginId = config.loginId;
    this.apiKey = config.apiKey;
    this.apiVersion = config.apiVersion || 130;
  }

  private async request<T>(serviceId: number, payload: any): Promise<T> {
    const requestBody = {
      serviceId,
      apiVer: this.apiVersion,
      auth: {
        acctId: parseInt(this.accountId),
        loginId: this.loginId,
        key: this.apiKey,
      },
      ...payload,
    };

    console.debug(`Sage Connect API request - Service ${serviceId}`);
    console.info(`Sage Connect request body:`, JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Check for Sage Connect errors
      if (result.errNum && result.errNum !== 0) {
        const error = this.handleSageError(result.errNum);
        throw new Error(`Sage Connect Error ${result.errNum}: ${error}`);
      }

      return result as T;
    } catch (error) {
      console.error(`Sage Connect API request failed (Service ${serviceId}):`, error);
      throw error;
    }
  }

  private handleSageError(errorCode: number): string {
    const errorMap: Record<number, string> = {
      10001: "General system error",
      10002: "Service not available right now. Please try back shortly.",
      10003: "Invalid host. The host part of your URL must be www.promoplace.com.",
      10004: "The Connect API requires that requests be sent via SSL encryption.",
      10005: "No post content found. Make sure you are using POST.",
      10006: "Invalid or missing API version. Check your JSON data structure.",
      10007: "Invalid account number in AcctID field.",
      10008: "Incorrect AcctID, LoginID or Token. Please check your credentials.",
      10009: "Invalid service ID. Please check the documentation.",
      10010: "The requested service is not currently enabled.",
      10011: "An Advantage Membership is required for suppliers to access SAGE Connect API.",
      10012: "A SAGE Workplace subscription is required to access SAGE Connect API.",
      10013: "This user has reached the paid query limit for this month.",
      10501: "Product detail service unavailable or product not found. Try using the numeric Product ID instead of SPC code.",
      10701: "Inventory service unavailable. Stock information may not be accessible at this time.",
    };
    
    return errorMap[errorCode] || `Unknown Sage Connect error: ${errorCode}`;
  }

  async searchProducts(request: ProductSearchRequest): Promise<ProductSearchResponse> {
    const payload = {
      search: request.search,
      resultOptions: {
        limit: 25,
        offset: 0,
        sortBy: 'relevance',
        ...request.resultOptions,
      },
    };

    try {
      const response = await this.request<any>(103, payload); // Service ID 103: Product Search
      
      // Debug log the actual response structure
      console.info('Sage Connect raw response:', JSON.stringify(response, null, 2));
      
      // Transform the API response to match our interface
      const transformedProducts = (response.products || []).map((product: any) => ({
        productId: product.prodEId?.toString() || product.spc || '',
        prodEId: product.prodEId,
        spc: product.spc || '',
        prName: product.name || 'Promotional Product',
        name: product.name,
        category: product.category || 'General',
        prc: product.prc, // Keep as string/number as returned by API
        thumbPic: product.thumbPic,
        supplier: product.supplier,
        colors: product.colors,
        themes: product.themes,
        verified: product.verified,
        envFriendly: product.envFriendly,
      }));
      
      return {
        products: transformedProducts,
        totalFound: response.totalFound || 0,
        offset: response.offset || 0,
        limit: response.limit || transformedProducts.length || 25,
      };
    } catch (error) {
      console.error('Product search failed:', error);
      throw error;
    }
  }

  async getProductDetail(productId: string): Promise<ProductDetail> {
    // Service 105 expects prodEId as a number
    const payload = {
      prodEId: parseInt(productId, 10), // Convert string ID to number
      includeImages: true,
      includeSpecs: true,
      includePricing: true,
    };

    try {
      const response = await this.request<any>(105, payload); // Service ID 105: Full Product Detail
      
      // Debug log the response
      console.info('Service 105 response:', JSON.stringify(response, null, 2));
      
      // The response might have the product data at different levels
      // Try response.product first, then response itself
      const productData = response.product || response || {};
      
      // Transform to match our ProductDetail interface if needed
      return {
        ...productData,
        productId: productId, // Keep the original ID for reference
        prodEId: productData.prodEId || parseInt(productId, 10),
      };
    } catch (error) {
      console.error(`Product detail lookup failed for ${productId}:`, error);
      throw error;
    }
  }

  async checkInventory(productId: string): Promise<InventoryResponse> {
    const payload = {
      productId,
    };

    try {
      const response = await this.request<any>(107, payload); // Service ID 107: Inventory Status
      
      return {
        productId,
        inventory: response.inventory || [],
        lastUpdated: response.lastUpdated || new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Inventory check failed for ${productId}:`, error);
      throw error;
    }
  }

  async getCategories(): Promise<CategoriesResponse> {
    const payload = {
      includeThemes: true,
    };

    try {
      const response = await this.request<any>(101, payload); // Service ID 101: Research List Service
      
      return {
        categories: response.categories || [],
        themes: response.themes || [],
      };
    } catch (error) {
      console.error('Categories lookup failed:', error);
      throw error;
    }
  }

  // Validation helper methods
  validateSearchRequest(request: ProductSearchRequest): { isValid: boolean; error?: string } {
    if (!request.search || Object.keys(request.search).length === 0) {
      return { isValid: false, error: "Search criteria cannot be empty" };
    }

    if (request.search.priceLow !== undefined && request.search.priceHigh !== undefined) {
      if (request.search.priceLow > request.search.priceHigh) {
        return { isValid: false, error: "Price low cannot be greater than price high" };
      }
    }

    if (request.search.qty !== undefined && request.search.qty <= 0) {
      return { isValid: false, error: "Quantity must be positive" };
    }

    return { isValid: true };
  }

  validateProductId(productId: string): boolean {
    return productId && productId.trim().length > 0;
  }

  // Static method to create client from environment variables
  static fromEnvironment(): SageConnectClient {
    const requiredVars = [
      'SAGE_ACCOUNT_ID',
      'SAGE_LOGIN_ID', 
      'SAGE_API_KEY',
      'SAGE_API_URL'
    ];

    const missing = requiredVars.filter(varName => !process.env[varName]);
    if (missing.length > 0) {
      throw new Error(`Missing required Sage Connect environment variables: ${missing.join(', ')}`);
    }

    return new SageConnectClient({
      accountId: process.env.SAGE_ACCOUNT_ID!,
      loginId: process.env.SAGE_LOGIN_ID!,
      apiKey: process.env.SAGE_API_KEY!,
      apiUrl: process.env.SAGE_API_URL!,
      apiVersion: parseInt(process.env.SAGE_API_VERSION || '130'),
    });
  }
}