// // src/schemas/place.schema.ts
// import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
// import { Document, SchemaTypes } from 'mongoose';

// export type PlaceDocument = Place & Document;

// @Schema({ _id: false })
// class GeoPoint {
//   @Prop({ enum: ['Point'], default: 'Point' })
//   type: 'Point';

//   @Prop({ type: [Number], required: true }) // [lon, lat]
//   coordinates: [number, number];
// }

// @Schema({ _id: false })
// class Images {
//   @Prop() thumbnail?: string;
//   @Prop() original?: string;
// }

// @Schema({ _id: false })
// class WikidataSubdoc {
//   @Prop() qid?: string;
//   @Prop([String]) instanceOf?: string[];
//   @Prop([String]) countries?: string[];
//   @Prop([String]) administrativeAreas?: string[];
//   @Prop([String]) ranges?: string[];
//   @Prop() elevation_m?: number;
//   @Prop() height_m?: number;
//   @Prop() prominence_m?: number;
//   @Prop() isolation_km?: number;
//   @Prop([String]) architects?: string[];
//   @Prop({ type: GeoPoint, required: false }) coordinates?: GeoPoint;
// }

// @Schema({ timestamps: true })
// export class Place {
//   @Prop({ required: true }) title: string;
//   @Prop() pageUrl?: string;

//   @Prop() descriptionShort?: string;
//   @Prop() descriptionHtml?: string;
//   @Prop() descriptionLong?: string;

//   @Prop({ type: Images, default: {} }) images?: Images;
//   @Prop({ type: GeoPoint, required: false }) coordinates?: GeoPoint;

//   @Prop({ type: WikidataSubdoc, default: {} }) wikidata?: WikidataSubdoc;

//   // optional: keep raw API payload for debugging
//   @Prop({ type: SchemaTypes.Mixed }) raw?: any;
// }

// export const PlaceSchema = SchemaFactory.createForClass(Place);

// // Indexes
// PlaceSchema.index({ 'wikidata.qid': 1 }, { unique: true, sparse: true });
// PlaceSchema.index({ coordinates: '2dsphere' });
// PlaceSchema.index({ 'wikidata.coordinates': '2dsphere' });
// PlaceSchema.index({ title: 'text', descriptionShort: 'text' });




// src/schemas/place.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type PlaceDocument = Place & Document;

@Schema({ _id: false })
class GeoPoint {
  @Prop({ enum: ['Point'], default: 'Point' })
  type: 'Point';

  @Prop({ type: [Number], required: true }) // [lon, lat]
  coordinates: [number, number];
}

@Schema({ _id: false })
class ImageItem {
  @Prop() title?: string;
  @Prop() original?: string;
  @Prop() thumbnail?: string;
  @Prop() localOriginal?: string;
  @Prop() localThumbnail?: string;
}

@Schema({ _id: false })
class Images {
  @Prop() thumbnail?: string;
  @Prop() original?: string;
  @Prop() localThumbnail?: string;
  @Prop() localOriginal?: string;

  // Multiple images (at least 5–6) will be saved here
  @Prop({ type: [ImageItem], default: [] })
  gallery?: ImageItem[];
}

@Schema({ _id: false })
class WikidataSubdoc {
  @Prop() qid?: string;
  @Prop([String]) instanceOf?: string[];
  @Prop([String]) countries?: string[];
  @Prop([String]) administrativeAreas?: string[];
  @Prop([String]) ranges?: string[];
  @Prop() elevation_m?: number;
  @Prop() height_m?: number;
  @Prop() prominence_m?: number;
  @Prop() isolation_km?: number;
  @Prop([String]) architects?: string[];
  @Prop({ type: GeoPoint, required: false }) coordinates?: GeoPoint;
}

@Schema({ timestamps: true })
export class Place {
  @Prop({ required: true }) title: string;
  @Prop() pageUrl?: string;

  @Prop() descriptionShort?: string;
  @Prop() descriptionHtml?: string;
  @Prop() descriptionLong?: string;

  @Prop({ type: Images, default: {} }) images?: Images;
  @Prop({ type: GeoPoint, required: false }) coordinates?: GeoPoint;

  @Prop({ type: WikidataSubdoc, default: {} }) wikidata?: WikidataSubdoc;

  // optional: keep raw API payload for debugging
  @Prop({ type: SchemaTypes.Mixed }) raw?: any;
}

export const PlaceSchema = SchemaFactory.createForClass(Place);

// Indexes
PlaceSchema.index({ 'wikidata.qid': 1 }, { unique: true, sparse: true });
PlaceSchema.index({ coordinates: '2dsphere' });
PlaceSchema.index({ 'wikidata.coordinates': '2dsphere' });
PlaceSchema.index({ title: 'text', descriptionShort: 'text' });