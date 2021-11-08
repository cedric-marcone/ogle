import * as MySQL from "mysql";

export type Pools = {
  [name: string]: MySQL.PoolConfig;
};

type InsertResult = { insertId: number };
type UpdateResult = { changedRows: number };
type DeleteResult = { affectedRows: number };
type Transform<A, B> = (a: A) => B;

const pools: { [name: string]: MySQL.Pool } = {};

const typeCast: MySQL.TypeCast = (field, next) => {
  if (field.type === "JSON") {
    const value = field.string();
    return typeof value === "string" ? JSON.parse(value) : next();
  }
  return next();
};

export function initPools(configs: Pools) {
  for (const [poolName, config] of Object.entries(configs)) {
    pools[poolName] = MySQL.createPool({ ...config, typeCast });
  }
}

export class SQL {
  poolName = "default";
  literals: string[];
  values: unknown[];

  constructor(
    literals: ReadonlyArray<string> | string = "",
    values: unknown[] = []
  ) {
    this.literals = Array.isArray(literals) ? [...literals] : [literals];
    this.values = values;
  }
  get sql() {
    return this.literals.join("?");
  }
  private get pool() {
    if (pools[this.poolName] === undefined) {
      throw new Error(`Unknown database "${this.poolName}" specified`);
    }
    return pools[this.poolName];
  }

  append(partial: SQL | string) {
    const lastIndex = this.literals.length - 1;
    if (partial instanceof SQL) {
      const [head, ...tail] = partial.literals;
      this.literals[lastIndex] += ` ${head}`;
      this.literals = [...this.literals, ...tail];
      this.values = [...this.values, ...partial.values];
    } else {
      this.literals[lastIndex] += ` ${partial}`;
    }
    return this;
  }
  appendIf(condition: boolean, partial: SQL | string) {
    return condition ? this.append(partial) : this;
  }
  database(name: string) {
    this.poolName = name;
    return this;
  }

  async many<A>() {
    return new Promise<A[]>((resolve, reject) =>
      this.pool.query(this, (err, rows) => (err ? reject(err) : resolve(rows)))
    );
  }
  async one<A>() {
    const rows = await this.many<A>();
    return rows.length === 0 ? undefined : rows[0];
  }
  async mapMany<A, B>(transform: Transform<A, B>) {
    const rows = await this.many<A>();
    return rows.map(transform);
  }
  async mapOne<A, B>(transform: Transform<A, B>) {
    const row = await this.one<A>();
    return row === undefined ? undefined : transform(row);
  }
  async insert() {
    return this.mapOne((r: InsertResult) => r.insertId);
  }
  async update() {
    return this.mapOne((r: UpdateResult) => r.changedRows);
  }
  async delete() {
    return this.mapOne((r: DeleteResult) => r.affectedRows);
  }
}

export function query(
  literals: ReadonlyArray<string> | string,
  ...values: unknown[]
) {
  return new SQL(literals, values);
}

export default query;
