import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, JoinTable, ManyToMany, ManyToOne,
  OneToMany, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export type Role = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended';
export type RecordType = 'oral' | 'photo' | 'record' | 'testimony';
export type RecordFormat = 'audio' | 'video' | 'image' | 'document' | 'text';
export type RecordStatus = 'draft' | 'published' | 'unpublished';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export const RECORD_TYPES: RecordType[] = ['oral', 'photo', 'record', 'testimony'];
export const RECORD_FORMATS: RecordFormat[] = ['audio', 'video', 'image', 'document', 'text'];
export const RECORD_STATUSES: RecordStatus[] = ['draft', 'published', 'unpublished'];

const numeric = { to: (v?: number | null) => v, from: (v?: string | null) => (v == null ? null : Number(v)) };

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Index({ unique: true }) @Column() email: string;
  @Column({ select: false }) passwordHash: string;
  @Column({ type: 'varchar', default: 'user' }) role: Role;
  @Column({ type: 'varchar', default: 'active' }) status: UserStatus;
  @Column({ default: '' }) organisation: string;
  @Column({ default: 0, select: false }) failedLogins: number;
  @Column({ type: 'timestamptz', nullable: true, select: false }) lockedUntil: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lastLoginAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: User;
  @Column() tokenHash: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @Column({ default: '' }) userAgent: string;
  @Column({ default: '' }) ip: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('password_reset_tokens')
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') userId: string;
  @Column() tokenHash: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) usedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** Controlled vocabulary: the waters an item relates to. */
@Entity('water_bodies')
export class WaterBody {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true }) @Column() name: string;
  @Column({ type: 'varchar' }) kind: 'ocean' | 'lake' | 'river';
  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true, transformer: numeric }) latitude: number | null;
  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true, transformer: numeric }) longitude: number | null;
}

/** Controlled vocabulary: subject headings. */
@Entity('subjects')
export class Subject {
  @PrimaryGeneratedColumn() id: number;
  @Index({ unique: true }) @Column() slug: string;
  @Column() label: string;
}

/** An archive item: oral history, photograph, record/report or testimony. */
@Entity('records')
export class ArchiveRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ insert: false, update: false }) identifier: string;
  @Column({ type: 'varchar' }) type: RecordType;
  @Column({ type: 'varchar' }) format: RecordFormat;
  @Column() title: string;
  @Column({ type: 'text', default: '' }) summary: string;
  @Column({ type: 'text', nullable: true }) body: string | null;
  @Column({ type: 'int', nullable: true }) year: number | null;
  @Column({ default: false }) yearApproximate: boolean;
  @Column({ type: 'int', nullable: true }) waterBodyId: number | null;
  @ManyToOne(() => WaterBody, { nullable: true, eager: true }) @JoinColumn({ name: 'water_body_id' }) waterBody: WaterBody | null;
  @Column({ default: '' }) county: string;
  @Column({ default: '' }) place: string;
  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true, transformer: numeric }) latitude: number | null;
  @Column({ type: 'numeric', precision: 9, scale: 6, nullable: true, transformer: numeric }) longitude: number | null;
  @Column({ default: '' }) creator: string;
  @Column({ default: '' }) narrator: string;
  @Column({ default: '' }) interviewer: string;
  @Column({ default: '' }) photographer: string;
  @Column({ default: '' }) language: string;
  @Column({ default: '' }) rights: string;
  @Column({ default: '' }) consent: string;
  @Column({ type: 'int', nullable: true }) durationSeconds: number | null;
  @Column({ type: 'varchar', default: 'draft' }) status: RecordStatus;
  @Column({ default: 0 }) views: number;
  @Column({ type: 'text', default: '', select: false }) searchText: string;
  @Column({ type: 'tsvector', select: false, insert: false, update: false }) search: string;
  @ManyToMany(() => Subject, { eager: true }) @JoinTable({ name: 'record_subjects', joinColumn: { name: 'record_id' }, inverseJoinColumn: { name: 'subject_id' } }) subjects: Subject[];
  @OneToMany(() => TranscriptSegment, (s) => s.record, { cascade: true }) transcript: TranscriptSegment[];
  @OneToMany(() => MediaFile, (m) => m.record) media: MediaFile[];
  @Column({ type: 'uuid', nullable: true }) createdById: string | null;
  @Column({ type: 'uuid', nullable: true }) updatedById: string | null;
  @Column({ type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
  @DeleteDateColumn({ type: 'timestamptz' }) deletedAt: Date | null;
}

@Entity('transcript_segments')
export class TranscriptSegment {
  @PrimaryGeneratedColumn() id: number;
  @Column('uuid') recordId: string;
  @ManyToOne(() => ArchiveRecord, (r) => r.transcript, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'record_id' }) record: ArchiveRecord;
  @Column() position: number;
  @Column() startSeconds: number;
  @Column({ type: 'text' }) text: string;
}

/** A stored file. Originals are kept; web copies and thumbnails can sit alongside. */
@Entity('media_files')
export class MediaFile {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) recordId: string | null;
  @ManyToOne(() => ArchiveRecord, (r) => r.media, { onDelete: 'SET NULL', nullable: true }) @JoinColumn({ name: 'record_id' }) record: ArchiveRecord | null;
  @Column({ type: 'uuid', nullable: true }) submissionId: string | null;
  @Column({ type: 'varchar', default: 'original' }) role: 'original' | 'web' | 'thumbnail';
  @Column() storageKey: string;
  @Column() originalName: string;
  @Column() mimeType: string;
  @Column({ type: 'bigint', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } }) sizeBytes: number;
  @Column() sha256: string;
  @Column({ type: 'uuid', nullable: true }) uploadedById: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ insert: false, update: false }) reference: string;
  @Column('uuid') submittedById: string;
  @ManyToOne(() => User, { eager: false }) @JoinColumn({ name: 'submitted_by_id' }) submittedBy: User;
  @Column({ type: 'varchar' }) type: RecordType;
  @Column() title: string;
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'int', nullable: true }) year: number | null;
  @Column({ type: 'int', nullable: true }) waterBodyId: number | null;
  @ManyToOne(() => WaterBody, { nullable: true, eager: true }) @JoinColumn({ name: 'water_body_id' }) waterBody: WaterBody | null;
  @Column({ default: '' }) place: string;
  @Column() consentConfirmed: boolean;
  @Column({ type: 'varchar', default: 'pending' }) status: SubmissionStatus;
  @Column({ type: 'text', default: '' }) reviewNote: string;
  @Column({ type: 'uuid', nullable: true }) reviewedById: string | null;
  @Column({ type: 'timestamptz', nullable: true }) reviewedAt: Date | null;
  @Column({ type: 'uuid', nullable: true }) recordId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('messages')
export class ContactMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column() email: string;
  @Column() subject: string;
  @Column({ type: 'text' }) body: string;
  @Column({ default: false }) read: boolean;
  @Column({ type: 'uuid', nullable: true }) userId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** Audit trail of every sign-in and admin action. */
@Entity('activity_log')
export class Activity {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } }) id: number;
  @Column({ type: 'uuid', nullable: true }) actorId: string | null;
  @Column({ default: '' }) actorName: string;
  @Column() action: string;
  @Column({ default: '' }) entityType: string;
  @Column({ default: '' }) entityId: string;
  @Column({ default: '' }) summary: string;
  @Column({ type: 'jsonb', default: {} }) details: Record<string, unknown>;
  @Column({ default: '' }) ip: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('record_views')
export class RecordView {
  @PrimaryColumn({ type: 'bigint', generated: 'increment', transformer: { to: (v: number) => v, from: (v: string) => Number(v) } }) id: number;
  @Column('uuid') recordId: string;
  @Column({ type: 'uuid', nullable: true }) userId: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) viewedAt: Date;
}

export const ENTITIES = [User, RefreshToken, PasswordResetToken, WaterBody, Subject, ArchiveRecord, TranscriptSegment, MediaFile, Submission, ContactMessage, Activity, RecordView];
