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
  MovementType,
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
  ConsumptionCharge,
  PeopleActivity,
  PeriodCharges,
  PeriodRanking,
  PeriodRankingStatus,
  RankingPeriod,
  RankingPeriodOption,
  RankingScope,
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
  /** Cambia el código con el que el admin entra desde la máquina (pide su contraseña). */
  setAdminCode(password: string, code: string): Promise<void>;
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
  /** Cuánto sacó y metió cada persona en la quincena abierta (o la indicada). */
  activity(periodId?: string): Promise<PeopleActivity>;
  create(input: CreatePersonInput): Promise<Person>;
  update(id: string, input: UpdatePersonInput): Promise<Person>;
  /** Pide la contraseña del admin que hace el cambio. */
  resetPin(id: string, pin: string, adminPassword: string): Promise<Person>;
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
  topWithdrawers(scope?: RankingPeriod | RankingScope, limit?: number): Promise<TopWithdrawer[]>;
  dashboard(): Promise<DashboardSummary>;
}

export interface FundingService {
  list(): Promise<PeriodSummary[]>;
  current(): Promise<PeriodSummary | null>;
  detail(id: string): Promise<FundingPeriodDetail>;
  open(input: OpenPeriodInput): Promise<FundingPeriod>;
  close(id: string): Promise<FundingPeriod>;
  contribute(periodId: string, input: ContributionInput): Promise<Contribution>;
  /** Si el más hambriento de la quincena ya se calculó (y el resultado), o desde cuándo se puede. */
  ranking(periodId: string): Promise<PeriodRankingStatus>;
  /** Quien más consume, más aporta: cobros por consumo (estimación si la quincena sigue abierta). */
  charges(periodId: string): Promise<PeriodCharges>;
  /** Recalcula los cobros de una quincena cerrada (admin). */
  generateCharges(periodId: string): Promise<PeriodCharges>;
  /** Cobros de quincenas anteriores con saldo pendiente. */
  pendingCharges(): Promise<ConsumptionCharge[]>;
  /** Pago (total si no se indica monto) de un cobro: aporte a la quincena abierta. */
  payCharge(chargeId: string, input?: { amount?: string; note?: string | null }): Promise<Contribution>;
  /** "Calcular el más hambriento" (solo admin; la quincena debe haber terminado o estar cerrada). */
  computeRanking(periodId: string): Promise<PeriodRanking>;
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
  /** Categorías (para filtrar los productos en la tablet). */
  categories(): Promise<Category[]>;
  topWithdrawers(scope?: RankingPeriod | RankingScope, limit?: number): Promise<TopWithdrawer[]>;
  /** El último más hambriento calculado (null si nunca se ha calculado). */
  latestHungriest(): Promise<PeriodRanking | null>;
  /** Quincenas para el ranking, la más reciente primero. */
  rankingPeriods(): Promise<RankingPeriodOption[]>;
  periodRanking(periodId: string): Promise<PeriodRankingStatus>;
  /** "Calcular el más hambriento" desde la tablet (solo la primera vez; recalcular es del admin). */
  computeRanking(periodId: string): Promise<PeriodRanking>;
  latestMovements(limit?: number): Promise<MovementView[]>;
  /** Historial paginado de la máquina (GET /movements), con filtro opcional Retiros/Ingresos. */
  movements(query: { page: number; pageSize: number; type?: MovementType }): Promise<Page<MovementView>>;
  register(input: KioskMovementInput): Promise<KioskMovementResult>;
  /** Un administrador entra desde la máquina con su código; devuelve una sesión como el login. */
  adminSession(code: string): Promise<LoginResult>;
  /** Cambia el PIN: el actual identifica a la persona. Devuelve su nombre. */
  changePin(currentPin: string, newPin: string): Promise<{ name: string }>;
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
