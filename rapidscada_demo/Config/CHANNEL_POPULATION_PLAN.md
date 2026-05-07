# Rapid SCADA 100-Agent Channel Population Plan

This file is the exact population guide for the SmartGrid 10x10 layout.

Use it after importing [Channels.xml](d:/Mtech%20Main%20project/smartgrid-audit-base-/rapidscada_demo/Config/Channels.xml).

The bridge currently considers an agent `live` only when these expected channels have `stat > 0`:

- `GEN-01..20`: voltage + current
- `SUB-21..50`: load + latency
- `PMU-51..75`: voltage + frequency
- `BRK-76..100`: status

## Population Rules

Use simulated formulas first if you do not yet have real device tags.

Recommended behavior:
- each agent gets a slightly different baseline
- each channel drifts slowly over time
- anomaly channels can stay informational
- avoid hard zero with `stat=0` for channels that should be considered live

## Generator Formulas

Apply to `GEN-01..20`.

- Voltage:
  - target range: `222-238 V`
  - formula pattern: `230 + offset + slow_drift`
- Current:
  - target range: `8-22 A`
  - formula pattern: `14 + offset + slow_drift`
- Anomaly:
  - target range: `0.0-1.5`
  - formula pattern: low baseline with occasional spike

Per-agent offsets:

| Agent | Voltage Ch | Current Ch | Anomaly Ch | Voltage Offset | Current Offset |
|------|------:|------:|------:|------:|------:|
| G01 | 101 | 102 | 103 | -1.8 | -2.0 |
| G02 | 104 | 105 | 106 | -1.2 | -1.4 |
| G03 | 107 | 108 | 109 | -0.6 | -0.8 |
| G04 | 110 | 111 | 112 | 0.0 | -0.2 |
| G05 | 113 | 114 | 115 | 0.6 | 0.4 |
| G06 | 116 | 117 | 118 | 1.2 | 1.0 |
| G07 | 119 | 120 | 121 | 1.8 | 1.6 |
| G08 | 122 | 123 | 124 | -1.5 | 2.2 |
| G09 | 125 | 126 | 127 | -0.9 | -1.8 |
| G10 | 128 | 129 | 130 | -0.3 | -1.2 |
| G11 | 131 | 132 | 133 | 0.3 | -0.6 |
| G12 | 134 | 135 | 136 | 0.9 | 0.0 |
| G13 | 137 | 138 | 139 | 1.5 | 0.6 |
| G14 | 140 | 141 | 142 | -1.6 | 1.2 |
| G15 | 143 | 144 | 145 | -1.0 | 1.8 |
| G16 | 146 | 147 | 148 | -0.4 | 2.4 |
| G17 | 149 | 150 | 151 | 0.2 | -1.6 |
| G18 | 152 | 153 | 154 | 0.8 | -1.0 |
| G19 | 155 | 156 | 157 | 1.4 | -0.4 |
| G20 | 158 | 159 | 160 | 2.0 | 0.2 |

Suggested formulas:

- Voltage:
  - `230 + voltage_offset + 2 * sin(time/30)`
- Current:
  - `14 + current_offset + 1.5 * cos(time/24)`
- Anomaly:
  - `abs(sin(time/40 + agent_index/5)) * 0.4`

## Substation Formulas

Apply to `SUB-21..50`.

- Load:
  - target range: `80-260 kW`
  - formula pattern: `160 + offset + drift`
- Latency:
  - target range: `2-12 ms`
  - formula pattern: `4 + offset + drift`
- Anomaly:
  - target range: `0.0-1.2`

Per-agent offsets:

| Agent | Load Ch | Latency Ch | Anomaly Ch | Load Offset | Latency Offset |
|------|------:|------:|------:|------:|------:|
| S21 | 201 | 202 | 203 | -40 | -1.0 |
| S22 | 204 | 205 | 206 | -32 | -0.8 |
| S23 | 207 | 208 | 209 | -24 | -0.6 |
| S24 | 210 | 211 | 212 | -16 | -0.4 |
| S25 | 213 | 214 | 215 | -8 | -0.2 |
| S26 | 216 | 217 | 218 | 0 | 0.0 |
| S27 | 219 | 220 | 221 | 8 | 0.2 |
| S28 | 222 | 223 | 224 | 16 | 0.4 |
| S29 | 225 | 226 | 227 | 24 | 0.6 |
| S30 | 228 | 229 | 230 | 32 | 0.8 |
| S31 | 231 | 232 | 233 | 40 | 1.0 |
| S32 | 234 | 235 | 236 | -36 | -0.9 |
| S33 | 237 | 238 | 239 | -28 | -0.7 |
| S34 | 240 | 241 | 242 | -20 | -0.5 |
| S35 | 243 | 244 | 245 | -12 | -0.3 |
| S36 | 246 | 247 | 248 | -4 | -0.1 |
| S37 | 249 | 250 | 251 | 4 | 0.1 |
| S38 | 252 | 253 | 254 | 12 | 0.3 |
| S39 | 255 | 256 | 257 | 20 | 0.5 |
| S40 | 258 | 259 | 260 | 28 | 0.7 |
| S41 | 261 | 262 | 263 | 36 | 0.9 |
| S42 | 264 | 265 | 266 | -34 | -0.8 |
| S43 | 267 | 268 | 269 | -26 | -0.6 |
| S44 | 270 | 271 | 272 | -18 | -0.4 |
| S45 | 273 | 274 | 275 | -10 | -0.2 |
| S46 | 276 | 277 | 278 | -2 | 0.0 |
| S47 | 279 | 280 | 281 | 6 | 0.2 |
| S48 | 282 | 283 | 284 | 14 | 0.4 |
| S49 | 285 | 286 | 287 | 22 | 0.6 |
| S50 | 288 | 289 | 290 | 30 | 0.8 |

Suggested formulas:

- Load:
  - `160 + load_offset + 25 * sin(time/28)`
- Latency:
  - `4 + latency_offset + 1.2 * abs(cos(time/20))`
- Anomaly:
  - `abs(sin(time/55 + agent_index/7)) * 0.3`

## PMU Formulas

Apply to `PMU-51..75`.

- Voltage:
  - target range: `224-236 V`
- Frequency:
  - target range: `49.85-50.15 Hz`
- Anomaly:
  - target range: `0.0-1.0`

Per-agent offsets:

| Agent | Voltage Ch | Frequency Ch | Anomaly Ch | Voltage Offset | Frequency Offset |
|------|------:|------:|------:|------:|------:|
| P51 | 301 | 302 | 303 | -1.2 | -0.05 |
| P52 | 304 | 305 | 306 | -0.9 | -0.04 |
| P53 | 307 | 308 | 309 | -0.6 | -0.03 |
| P54 | 310 | 311 | 312 | -0.3 | -0.02 |
| P55 | 313 | 314 | 315 | 0.0 | -0.01 |
| P56 | 316 | 317 | 318 | 0.3 | 0.00 |
| P57 | 319 | 320 | 321 | 0.6 | 0.01 |
| P58 | 322 | 323 | 324 | 0.9 | 0.02 |
| P59 | 325 | 326 | 327 | 1.2 | 0.03 |
| P60 | 328 | 329 | 330 | -1.1 | 0.04 |
| P61 | 331 | 332 | 333 | -0.8 | 0.05 |
| P62 | 334 | 335 | 336 | -0.5 | -0.05 |
| P63 | 337 | 338 | 339 | -0.2 | -0.04 |
| P64 | 340 | 341 | 342 | 0.1 | -0.03 |
| P65 | 343 | 344 | 345 | 0.4 | -0.02 |
| P66 | 346 | 347 | 348 | 0.7 | -0.01 |
| P67 | 349 | 350 | 351 | 1.0 | 0.00 |
| P68 | 352 | 353 | 354 | -1.0 | 0.01 |
| P69 | 355 | 356 | 357 | -0.7 | 0.02 |
| P70 | 358 | 359 | 360 | -0.4 | 0.03 |
| P71 | 361 | 362 | 363 | -0.1 | 0.04 |
| P72 | 364 | 365 | 366 | 0.2 | 0.05 |
| P73 | 367 | 368 | 369 | 0.5 | -0.05 |
| P74 | 370 | 371 | 372 | 0.8 | -0.04 |
| P75 | 373 | 374 | 375 | 1.1 | -0.03 |

Suggested formulas:

- Voltage:
  - `230 + voltage_offset + 1.5 * sin(time/22)`
- Frequency:
  - `50 + frequency_offset + 0.05 * sin(time/18)`
- Anomaly:
  - `abs(cos(time/60 + agent_index/6)) * 0.25`

## Breaker Formulas

Apply to `BRK-76..100`.

- Status:
  - target values: mostly `1`
  - occasional `0` for test events
- Fault Count:
  - target values: `0-5` normally
- Anomaly:
  - target range: `0.0-1.2`

| Agent | Status Ch | Fault Ch | Anomaly Ch |
|------|------:|------:|------:|
| B76 | 401 | 402 | 403 |
| B77 | 404 | 405 | 406 |
| B78 | 407 | 408 | 409 |
| B79 | 410 | 411 | 412 |
| B80 | 413 | 414 | 415 |
| B81 | 416 | 417 | 418 |
| B82 | 419 | 420 | 421 |
| B83 | 422 | 423 | 424 |
| B84 | 425 | 426 | 427 |
| B85 | 428 | 429 | 430 |
| B86 | 431 | 432 | 433 |
| B87 | 434 | 435 | 436 |
| B88 | 437 | 438 | 439 |
| B89 | 440 | 441 | 442 |
| B90 | 443 | 444 | 445 |
| B91 | 446 | 447 | 448 |
| B92 | 449 | 450 | 451 |
| B93 | 452 | 453 | 454 |
| B94 | 455 | 456 | 457 |
| B95 | 458 | 459 | 460 |
| B96 | 461 | 462 | 463 |
| B97 | 464 | 465 | 466 |
| B98 | 467 | 468 | 469 |
| B99 | 470 | 471 | 472 |
| B100 | 473 | 474 | 475 |

Suggested formulas:

- Status:
  - normal: `1`
  - test event pattern: set a few selected breakers to `0` for short periods
- Fault Count:
  - `0` normally, increment during simulated test cases
- Anomaly:
  - `if(status == 0, 1.0, 0.1)`

## Recommended Bring-Up Order

1. Populate all generator live channels:
   - voltage + current for `G01-G20`
2. Populate all substation live channels:
   - load + latency for `S21-S50`
3. Populate all PMU live channels:
   - voltage + frequency for `P51-P75`
4. Populate all breaker live channels:
   - status for `B76-B100`

## Validation Command

After each publish, run:

```powershell
.\scripts\trace_rapidscada_live_agents.ps1
```

Expected milestones:

- after generators: `20` live
- after substations: `50` live
- after PMUs: `75` live
- after breakers: `100` live

## Expected Result

When every required channel is populated with `stat > 0`, the dashboard should show:

- `100 / 100` SCADA agents available to the bridge
- `live` source for all 100 agents
- no fallback requirement except during outage conditions
