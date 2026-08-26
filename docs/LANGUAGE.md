# RoseWind language guide

## v0.2: whitespace-independent source

RoseWind v0.2 ignores every whitespace character outside string, regex, and comment literals. Punctuation separates declarations, so readable and minified programs have the same syntax tree and behavior. Even `l e t(score:num=42);` is valid and normalizes to `let(score:num=42);`.

```rosewind
let(score:num = 42);
let(nickname:text? = null);
let(values:list<num> = [1, 2, 3]);
let(record:dict<text, any> = { name: "RoseWind", stable: true });
let(tags:set<text> = set(["typed", "friendly"]));
```

Primitive types are `text`, `num`, `bool`, `void`, and `any`. Web data types are `date`, `time`, `bytes`, `decimal`, `id`, `set<T>`, and `regex`. A trailing `?` makes any type nullable.

Duration literals support `ms`, `s`, `m`, `h`, and `d`. Regex literals use `r"pattern"`. Whitespace inside `"text"`, `'text'`, `r"regex"`, and `/* block comments */` is preserved.

## Classes

```rosewind
class(Pet) {
    pub(name:text);
    priv(age:num);

    create(name:text, age:num) {
        self.name = name;
        self.age = age;
    }

    pub(speak()->void) {
        print("Hi, I am " + self.name);
    }
}

let(pet:Pet = new(Pet, "Buddy", 3));
pet.speak();
```

Inheritance uses `class(Child:Parent)`. Classes support `super`, public and private members, name-first typed parameters, and typed returns.

## Control flow

```rosewind
loop(item:range(0, 10)) {
    if(item == 5) { continue; }
    if(item > 7) { break; }
}

match(status) {
    case("ready") { print("Go"); }
    default { print("Wait"); }
}

try {
    print(parseJSON(payload));
} catch(error) {
    print(str(error));
}
```

`if`, `loop`, and `match` headers require parentheses. Iteration uses `loop(item:iterable)`. Returns use `return(value);` or `return();`.

## Comments and migration

v0.2 uses punctuation-delimited `/* ... */` comments. The v0.1 `//` form is deprecated because its meaning depends on a newline. RoseWind Studio accepts v0.1 during the compatibility release, shows migration hints, and provides **Convert document to v0.2**. Formatting a legacy document also emits readable v0.2 source.

## Standard library

| Function | Result |
| --- | --- |
| `print(...values)` | Writes to the studio or CLI output |
| `input(prompt)` | Asynchronous text input (empty in the non-interactive CLI) |
| `len(value)` | Collection, dictionary, or text length |
| `range(start, end, step)` | Number list |
| `str(value)`, `num(value)` | Safe primitive casts |
| `toJSON(value)`, `parseJSON(text)` | JSON conversion |
| `wait(duration)` | Non-blocking delay |
| `web.fetch(...)` | Fetch API access |
| `math.random()` | Random number in [0, 1) |
| `typeOf(value)` | Runtime type name |

Typed constructors include `date()`, `bytes()`, `decimal()`, `id()`, and `set()`.

## Grammar summary

Statements end with semicolons and blocks use braces. Declarations use `class(Name)`, `let(name:type=value);`, `pub(name:type);`, and `pub(method(parameters)->type)`. Match arms use `case(value) { ... }` and `default { ... }`. Use the Studio’s **Minify** command to verify that optional whitespace does not affect compilation.