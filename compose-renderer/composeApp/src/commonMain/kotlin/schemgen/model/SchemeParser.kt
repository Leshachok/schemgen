package schemgen.model

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Parses scheme JSON the same way web/js/format.js + web/js/render.js do: an item
 * is a seat if it has a `seat` key, otherwise everything else keys off `type`
 * (format decision D30). This is intentionally NOT delegated to
 * kotlinx.serialization's polymorphic/@Serializable machinery, because the JSON
 * has no discriminator field - matching the JS reference implementation's own
 * dynamic dispatch is more important than idiomatic serialization here.
 */
object SchemeParser {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    fun parse(rawJson: String): Scheme {
        val root = json.parseToJsonElement(rawJson).jsonObject
        return Scheme(
            key = root["key"]?.jsonPrimitive?.contentOrNull,
            rev = root["rev"]?.jsonPrimitive?.intOrNull,
            vehicle = root["vehicle"]?.jsonPrimitive?.contentOrNull,
            decks = (root["decks"] as? JsonArray)?.map(::parseDeck) ?: emptyList()
        )
    }

    private fun parseDeck(el: JsonElement): Deck {
        val o = el.jsonObject
        return Deck(
            level = o["level"]?.jsonPrimitive?.contentOrNull,
            rows = o["rows"]?.jsonPrimitive?.intOrNull ?: 1,
            columns = (o["columns"] as? JsonArray)?.map(::parseColumn) ?: emptyList()
        )
    }

    private fun parseColumn(el: JsonElement): Column {
        val o = el.jsonObject
        val items = (o["items"] as? JsonArray)?.map(::parseItem) ?: emptyList()
        return Column(items)
    }

    private fun parseItem(el: JsonElement): Item {
        val o = el.jsonObject
        val span = parseSpan(o["span"])
        val row = o["row"]?.jsonPrimitive?.intOrNull ?: 1
        val seat = o["seat"]?.jsonPrimitive?.contentOrNull
        return if (seat != null) {
            SeatItem(
                seat = seat,
                kind = o["kind"]?.jsonPrimitive?.contentOrNull ?: "",
                berth = o["berth"]?.jsonPrimitive?.contentOrNull,
                facing = o["facing"]?.jsonPrimitive?.contentOrNull,
                inclusive = o["inclusive"]?.jsonPrimitive?.booleanOrNull ?: false,
                row = row,
                span = span
            )
        } else {
            StructuralItem(
                type = o["type"]?.jsonPrimitive?.contentOrNull,
                facing = o["facing"]?.jsonPrimitive?.contentOrNull,
                row = row,
                span = span,
                hasExplicitSpan = o["span"] != null
            )
        }
    }

    private fun parseSpan(el: JsonElement?): Span {
        if (el == null) return Span()
        val o = el.jsonObject
        return Span(
            rows = o["rows"]?.jsonPrimitive?.intOrNull ?: 1,
            cols = o["cols"]?.jsonPrimitive?.intOrNull ?: 1
        )
    }

    /**
     * The postMessage contract from web/js/app.js's "Send current scheme" button:
     * `{ "type": "schemgen:scheme", "payload": <scheme JSON> }`. Returns null if
     * [rawJson] isn't that envelope (e.g. some other message reached the frame).
     */
    fun parseEnvelope(rawJson: String): Scheme? {
        val root = runCatching { json.parseToJsonElement(rawJson).jsonObject }.getOrNull() ?: return null
        if (root["type"]?.jsonPrimitive?.contentOrNull != "schemgen:scheme") return null
        val payload = root["payload"] as? JsonObject ?: return null
        return parse(payload.toString())
    }
}
