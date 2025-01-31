import { assertNever } from '../util';
import { Definition, Expression } from './expression';
import {
    IntIntervalType,
    IntervalType,
    NumericLiteralType,
    StringLiteralType,
    StructType,
    Type,
    UnionType,
    WithUnderlying,
} from './types';

export type UnderlyingGroup<T extends Type> = {
    [key in Type['underlying']]: WithUnderlying<key, T>[];
};
export const groupByUnderlying = <T extends Type>(types: readonly T[]): UnderlyingGroup<T> => {
    const groups: UnderlyingGroup<T> = {
        never: [],
        any: [],
        number: [],
        string: [],
        struct: [],
        union: [],
    };
    for (const t of types) {
        groups[t.underlying].push(t as never);
    }
    return groups;
};

export const isSameStructType = (a: StructType, b: StructType): boolean => {
    if (a.name !== b.name) return false;

    if (a.fields.length !== b.fields.length) {
        throw new Error(
            'Invalid struct.' +
                ' Expected all structs with the same name to have the same number of fields.' +
                ` a = ${a.getTypeId()} , b = ${b.getTypeId()}`
        );
    }

    if (a.fields.some((f, i) => f.name !== b.fields[i].name)) {
        throw new Error(
            'Invalid struct.' +
                ' Expected all structs with the same name to have the same field names.' +
                ` a = ${a.getTypeId()} , b = ${b.getTypeId()}`
        );
    }

    return true;
};

export const isSameType = (a: Type, b: Type): boolean => a === b || a.getTypeId() === b.getTypeId();

export function* getReferences(expression: Expression | Definition): Iterable<string> {
    if (expression.type === 'named') {
        yield expression.name;
    }

    if (expression.underlying === 'expression') {
        switch (expression.type) {
            case 'intersection':
            case 'union':
                for (const e of expression.items) {
                    yield* getReferences(e);
                }
                break;
            case 'named':
                for (const f of expression.fields) {
                    yield* getReferences(f.type);
                }
                break;
            case 'field-access':
                yield* getReferences(expression.of);
                break;
            case 'builtin-function':
                for (const f of expression.args) {
                    yield* getReferences(f);
                }
                break;
            case 'match':
                yield* getReferences(expression.of);
                for (const arm of expression.arms) {
                    yield* getReferences(arm.pattern);
                    yield* getReferences(arm.to);
                }
                break;
            case 'scope':
                for (const d of expression.definitions) {
                    yield* getReferences(d);
                }
                yield* getReferences(expression.expression);
                break;
            default:
                yield assertNever(expression);
        }
    }

    if (expression.underlying === 'definition') {
        const definition: Definition = expression;
        switch (definition.type) {
            case 'variable':
                yield* getReferences(definition.value);
                break;
            case 'struct':
                for (const f of definition.fields) {
                    yield* getReferences(f.type);
                }
                break;
            case 'function':
                for (const f of definition.parameters) {
                    yield* getReferences(f.type);
                }
                break;
            default:
                yield assertNever(definition);
        }
    }
}

export const literal = (n: number) => {
    return new NumericLiteralType(n);
};
export const interval = (min: number, max: number) => {
    if (min === max) return new NumericLiteralType(min);
    return new IntervalType(min, max);
};
export const intInterval = (min: number, max: number) => {
    if (min === max) return new NumericLiteralType(min);
    return new IntIntervalType(min, max);
};

export const isNumericLiteral = (type: Type): type is NumericLiteralType => {
    return type.type === 'literal' && type.underlying === 'number';
};
export const isStringLiteral = (type: Type): type is StringLiteralType => {
    return type.type === 'literal' && type.underlying === 'string';
};

export type IntNumberType =
    | NumericLiteralType
    | IntIntervalType
    | UnionType<NumericLiteralType | IntIntervalType>;
export const isImage = (
    type: Type
): type is StructType & {
    readonly name: 'Image';
    readonly fields: readonly [
        { readonly name: 'width'; readonly type: IntNumberType },
        { readonly name: 'height'; readonly type: IntNumberType },
        { readonly name: 'channels'; readonly type: IntNumberType }
    ];
} => {
    return type.type === 'struct' && type.name === 'Image' && type.fields.length === 3;
};
