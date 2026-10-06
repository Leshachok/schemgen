package ua.gov.uz.schemgen.model

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

    /** Throws on malformed JSON or a non-object root; missing fields fall back to defaults. */
    fun parse(rawJson: String): Scheme = parse(json.parseToJsonElement(rawJson).jsonObject)

    /** For a consumer that already holds the scheme as a [JsonObject] (e.g. from its own DTO). */
    fun parse(root: JsonObject): Scheme {
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
}
