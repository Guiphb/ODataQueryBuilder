import { OrderBy } from './enums/order-by';
import { FilterMaker } from './filter-maker';
import { OdataQueryOptions } from './interfaces/odata-query-options';
import { PropertyClass, PropertyObjectType, PropertyType } from './property-class';

export class OdataQueryMaker<T> {
    private selects: string[] = [];
    private filters: string[] = [];
    private orderBys: string[] = [];
    private expands: OdataQueryMaker<T>[] = [];
    private skipValue: number;
    private topValue: number;
    private doCount: boolean;

    constructor(
        private options?: OdataQueryOptions,
        private extendedPropName?: string) {
            if (!this.options) {
                this.options = { ignoreNull: true };
            }
    }

    public clear(): void {
        this.selects = [];
        this.filters = [];
        this.orderBys = [];
        this.expands = [];
        this.skipValue = null;
        this.topValue = null;
        this.doCount = null;
    }

    public orderBy(field: PropertyType<T>): OdataQueryMaker<T> {
        return this.orderByInternal(field, OrderBy.Asc);
    }

    public orderByDesc(field: PropertyType<T>): OdataQueryMaker<T> {
        return this.orderByInternal(field, OrderBy.Desc);
    }

    private orderByInternal(field: PropertyType<T>, order: OrderBy): OdataQueryMaker<T> {
        if (!field || field.length === 0) { return this; }

        return this.freeOrderBy(`${PropertyClass.getPropertyName(field)} ${order}`);
    }

    public freeOrderBy(orderBy: string): OdataQueryMaker<T> {
        this.orderBys.push(orderBy);

        return this;
    }

    public expand(field: PropertyObjectType<T>,
                  func?: (query: OdataQueryMaker<T>) => void,
                  options?: OdataQueryOptions): OdataQueryMaker<T> {
        if (options) {
            options = this.options;
        }

        const expandQuery =
            new OdataQueryMaker<T>(options, PropertyClass.getPropertyObjectName(field));

        if (func !== null) {
            func(expandQuery);
        }

        this.expands.push(expandQuery);

        return this;
    }

    public filter(predicate: (filter: FilterMaker<T>) => FilterMaker<T>): this {
        if (this.filters.length > 1) {
            this.filters.push('and');
        }

        this.filters.push(
            predicate(new FilterMaker(this.options)).generate()
        );
        return this;
    }

    public skip(skip: number): OdataQueryMaker<T> {
        this.skipValue = skip;
        return this;
    }

    public top(top: number): OdataQueryMaker<T> {
        this.topValue = top;
        return this;
    }

    public count(): OdataQueryMaker<T> {
        this.doCount = true;
        return this;
    }

    public select(...fields: PropertyType<T>[]): OdataQueryMaker<T> {
        const selects: string[] = [];
        for (const field of fields) {
            selects.push(PropertyClass.getPropertyName(field));
        }

        this.selects = selects;
        return this;
    }

    public freeSelect(...fields: string[]): OdataQueryMaker<T> {
        this.selects = fields;
        return this;
    }

    private checkAndAppend(result: string, prefix: string, delimiter: string, variable: any): string {
        if (variable == null) { return result; }

        if (typeof variable === 'number' && variable === 0) { return result; }

        if (typeof variable === 'boolean' && !variable) { return result; }

        if (variable) { return this.append(result, prefix, delimiter, variable); }

        return result;
    }

    private append(result: string, prefix: string, delimiter: string, variable: any): string {
        const length = result.length;

        if (length > 0) {
            result = `${result}${delimiter}${prefix}=${variable}`;
        } else {
            result = `${prefix}=${variable}`;
        }

        return result;
    }

    public generate(): string {
        const isExpand = this.extendedPropName != null && this.extendedPropName.length > 0;

        let query = '';
        const delimiter = isExpand ? ';' : '&';

        if (this.topValue !== 0) {
            query = this.checkAndAppend(query, '$top', delimiter, this.topValue);
        }

        if (this.skipValue !== 0) {
            query = this.checkAndAppend(query, '$skip', delimiter, this.skipValue);
        }

        query = this.checkAndAppend(query, '$count', delimiter, this.doCount);

        if (this.filters.length > 0) {
            query = this.checkAndAppend(query, '$filter', delimiter, this.filters.join(` and `));
        }

        if (this.orderBys.length > 0) {
            query = this.checkAndAppend(query, '$orderby', delimiter, this.orderBys.join(','));
        }

        if (this.selects.length > 0) {
            query = this.checkAndAppend(query, '$select', delimiter, this.selects.join(','));
        }

        if (this.expands.length > 0) {
            const result = [];
            for (const item of this.expands) {
                result.push(item.generate());
            }

            if (result.length > 0) {
                query = this.checkAndAppend(query, '$expand', delimiter, result.join(','));
            }
        }

        if (query.length > 0 && isExpand) {
            query = `(${query})`;
        }

        if (isExpand) {
            query = `${this.extendedPropName}${query}`;
        }

        return query;
    }
}
