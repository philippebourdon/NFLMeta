# NFLMeta

Selected application source and official API clients for [NFLMeta](https://nflmeta.org).

This repository contains reviewed application components, utility logic, and
TypeScript and Python client libraries. It is a source reference, not a complete
production deployment. Some application components depend on modules that are
not included in this selection.

## API clients

See `sdk/typescript` and `sdk/python`. Their tests use mocked responses.

```sh
npm install
npm test
```

Python client tests:

```sh
PYTHONPATH=sdk/python/src python3 -m unittest discover -s sdk/python/tests
```

## Links

- [Website](https://nflmeta.org)
- [API documentation](https://nflmeta.org/api-docs)
- [What's new](https://nflmeta.org/changelog)

## Licence

Application source is covered by `LICENSE`. SDK code has its own MIT licence in
`sdk/LICENSE` and the client package directories.
