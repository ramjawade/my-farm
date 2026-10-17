"""The predefined crop list: every farmer sees these, grouped, in their own language.

One list serves the admin reference-seed endpoint. Migration 0010 carries its
own copy (migrations never import app code), and a test keeps the two equal.
`commodity` is the mandi feed's exact name for the crop, or None when the feed
has no price for it. Spellings are the feed's own; one that does not match
only means the crop shows "No price", and the price ingest reports it.
"""

from typing import NamedTuple


class SeedCrop(NamedTuple):
    name: str
    category: str
    commodity: str | None


CATEGORIES = ("cereal", "pulse", "oilseed", "cash", "vegetable", "fruit", "other")

PREDEFINED_CROPS: tuple[SeedCrop, ...] = (
    # Cereals
    SeedCrop("Wheat", "cereal", "Wheat"),
    SeedCrop("Rice", "cereal", "Paddy(Common)"),
    SeedCrop("Maize", "cereal", "Maize"),
    SeedCrop("Jowar", "cereal", "Jowar(Sorghum)"),
    SeedCrop("Bajra", "cereal", "Bajra(Pearl Millet/Cumbu)"),
    # Pulses
    SeedCrop("Tur", "pulse", "Arhar (Tur/Red Gram)(Whole)"),
    SeedCrop("Gram", "pulse", "Bengal Gram(Gram)(Whole)"),
    SeedCrop("Moong", "pulse", "Green Gram (Moong)(Whole)"),
    SeedCrop("Urad", "pulse", "Black Gram (Urd Beans)(Whole)"),
    # Oilseeds
    SeedCrop("Soybean", "oilseed", "Soyabean"),
    SeedCrop("Groundnut", "oilseed", "Groundnut"),
    SeedCrop("Sunflower", "oilseed", "Sunflower"),
    SeedCrop("Mustard", "oilseed", "Mustard"),
    SeedCrop("Sesame", "oilseed", "Sesamum(Sesame,Gingelly,Til)"),
    # Cash crops
    SeedCrop("Cotton", "cash", "Cotton"),
    SeedCrop("Sugarcane", "cash", None),
    SeedCrop("Turmeric", "cash", "Turmeric"),
    # Vegetables
    SeedCrop("Onion", "vegetable", "Onion"),
    SeedCrop("Tomato", "vegetable", "Tomato"),
    SeedCrop("Potato", "vegetable", "Potato"),
    SeedCrop("Brinjal", "vegetable", "Brinjal"),
    SeedCrop("Cabbage", "vegetable", "Cabbage"),
    SeedCrop("Cauliflower", "vegetable", "Cauliflower"),
    SeedCrop("Okra", "vegetable", "Bhindi(Ladies Finger)"),
    SeedCrop("Green chilli", "vegetable", "Green Chilli"),
    SeedCrop("Garlic", "vegetable", "Garlic"),
    SeedCrop("Ginger", "vegetable", "Ginger(Green)"),
    SeedCrop("Capsicum", "vegetable", "Capsicum"),
    # Fruits
    SeedCrop("Grapes", "fruit", "Grapes"),
    SeedCrop("Pomegranate", "fruit", "Pomegranate"),
    SeedCrop("Banana", "fruit", "Banana"),
    SeedCrop("Mango", "fruit", "Mango"),
    SeedCrop("Orange", "fruit", "Orange"),
    SeedCrop("Sweet lime", "fruit", "Mousambi(Sweet Lime)"),
    SeedCrop("Papaya", "fruit", "Papaya"),
    SeedCrop("Guava", "fruit", "Guava"),
    SeedCrop("Watermelon", "fruit", "Water Melon"),
    # Other: the two broad entries that existing crops may still use
    SeedCrop("Vegetables", "other", None),
    SeedCrop("Fruits", "other", None),
)

# Old catalog names that become a predefined name. Ids are kept, so crops
# that point at them keep working.
RENAMES: dict[str, str] = {"Corn": "Maize", "Soybeans": "Soybean"}

MAX_CROP_NAME_LENGTH = 100
