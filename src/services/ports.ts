import type {
  ContributionInput,
  CreateProductInput,
  CreateAdminInput,
  CreatePersonInput,
  DateRangeQuery,
  KioskMovementInput,
  MovementFilter,
  OpenPeriodInput,
  PersonFilter,
  ProductFilter,
  PurchaseFilter,
  RegisterPurchaseInput,
  ReportScope,
  StockMovementInput,
  UpdatePersonInput,
  UpdateProductInput,
  UpdateUserInput,
  UserFilter,
} from '@/domain/inputs';
import type {
  Category,
  CategorySpending,
  Contribution,
  DashboardSummary,
  FundingPeriod,
  FundingPeriodDetail,
  KioskDevice,
  KioskMovementResult,
  KioskPerson,
  LoginResult,
  MovementView,
  Page,
  PairKioskResult,
  Person,
  PeriodSummary,
  PricePoint,
  Product,
  ProductDetail,
  ProductSpending,
  PurchaseDetail,
  PurchaseListItem,
  RankingPeriod,
  StockMovementResult,
  TopWithdrawer,
  User,
  UserRef,
} from '@/domain/models';

/**
 * Puertos del front: las vistas y stores dependen de estas interfaces, no de axios (DIP).
 * Cada servicio agrupa un área de la API (ISP).
 */
export interface AuthService {
  login(email: string, password: string): Promise<LoginResult>;
  me(): Promise<User>;
}

/** Usuarios con cuenta (administradores) y lista mínima de todos para selectores. */
export interface UserService {
  list(filter?: UserFilter): Promise<User[]>;
  options(): Promise<UserRef[]>;
  createAdmin(input: CreateAdminInput): Promise<User>;
  update(id: string, input: UpdateUserInput): Promise<User>;
}

/** Personas de la tablet (nombre + PIN). Solo admin. */
export interface PeopleService {
  list(filter?: PersonFilter): Promise<Person[]>;
  create(input: CreatePersonInput): Promise<Person>;
  update(id: string, input: UpdatePersonInput): Promise<Person>;
  resetPin(id: string, pin: string): Promise<Person>;
}

/** Administración de tablets autorizadas. Solo admin. */
export interface KioskAdminService {
  listDevices(): Promise<KioskDevice[]>;
  pair(name: string): Promise<PairKioskResult>;
  revoke(id: string): Promise<KioskDevice>;
}

export interface CatalogService {
  listCategories(): Promise<Category[]>;
  createCategory(name: string): Promise<Category>;
  listProducts(filter?: ProductFilter): Promise<Product[]>;
  getProduct(id: string): Promise<ProductDetail>;
  createProduct(input: CreateProductInput): Promise<Product>;
  updateProduct(id: string, input: UpdateProductInput): Promise<Product>;
}

export interface MovementService {
  stockIn(input: StockMovementInput): Promise<StockMovementResult>;
  stockOut(input: StockMovementInput): Promise<StockMovementResult>;
  list(filter?: MovementFilter): Promise<Page<MovementView>>;
  topWithdrawers(period?: RankingPeriod, limit?: number): Promise<TopWithdrawer[]>;
  dashboard(): Promise<DashboardSummary>;
}

export interface FundingService {
  list(): Promise<PeriodSummary[]>;
  current(): Promise<PeriodSummary | null>;
  detail(id: string): Promise<FundingPeriodDetail>;
  open(input: OpenPeriodInput): Promise<FundingPeriod>;
  close(id: string): Promise<FundingPeriod>;
  contribute(periodId: string, input: ContributionInput): Promise<Contribution>;
}

export interface PurchaseService {
  list(filter?: PurchaseFilter): Promise<Page<PurchaseListItem>>;
  detail(id: string): Promise<PurchaseDetail>;
  register(input: RegisterPurchaseInput): Promise<PurchaseDetail>;
  void(id: string): Promise<PurchaseDetail>;
  receipt(id: string): Promise<Blob>;
}

export interface ReportService {
  spendingByProduct(scope: ReportScope): Promise<ProductSpending[]>;
  spendingByCategory(scope: ReportScope): Promise<CategorySpending[]>;
  priceHistory(productId: string, range?: DateRangeQuery): Promise<PricePoint[]>;
}

/**
 * Lo que usa la tablet, autenticada con su propio token (no con la sesión del admin).
 * Solo lectura del inventario + registrar con PIN.
 */
export interface KioskService {
  me(): Promise<KioskDevice>;
  people(): Promise<KioskPerson[]>;
  products(): Promise<Product[]>;
  topWithdrawers(period?: RankingPeriod, limit?: number): Promise<TopWithdrawer[]>;
  latestMovements(limit?: number): Promise<MovementView[]>;
  register(input: KioskMovementInput): Promise<KioskMovementResult>;
  changePin(personId: string, currentPin: string, newPin: string): Promise<void>;
}

export interface Services {
  auth: AuthService;
  users: UserService;
  people: PeopleService;
  kioskAdmin: KioskAdminService;
  kiosk: KioskService;
  catalog: CatalogService;
  movements: MovementService;
  funding: FundingService;
  purchases: PurchaseService;
  reports: ReportService;
}

/** Dónde se guarda el token de sesión. */
export interface TokenStorage {
  get(): string | null;
  set(token: string): void;
  clear(): void;
}
