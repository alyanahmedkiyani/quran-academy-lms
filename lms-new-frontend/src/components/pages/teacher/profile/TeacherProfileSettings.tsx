"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { all_routes } from "@/routes/all_routes";
import { useAppSelector } from "@/core/redux/hooks";
import { useDispatch } from "react-redux";
import { updateUserProfile } from "@/core/redux/authSlice";
import { resolveImageUrl } from "@/environment";
import {
  getTeacherById,
  updateTeacher,
  uploadTeacherImage,
  TeacherProfile,
} from "@/services/profileService";
import PhoneCountryInput from "@/components/shared/PhoneCountryInput";

const TeacherProfileSettings = () => {
  const dispatch = useDispatch();
  const { user, token } = useAppSelector((state) => state.auth);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contact: "",
    cnic: "",
  });
  const [imgSrc, setImgSrc] = useState<string>("/assets/img/users/user-08.jpg");
  const [imgUploading, setImgUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; msg: string } | null>(null);

  // Load profile on mount
  useEffect(() => {
    if (!user?.id || !token) return;
    getTeacherById(user.id)
      .then((data) => {
        setProfile(data);
        setForm({
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          email: data.email ?? "",
          contact: data.contact ?? "",
          cnic: data.cnic ?? "",
        });
        if (data.imageUrl) {
          setImgSrc(`${resolveImageUrl(data.imageUrl)}`);
          dispatch(updateUserProfile({ profileImg: data.imageUrl }));
        }
      })
      .catch(() => {/* silently ignore load errors */});
  }, [user?.id, token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageClick = () => fileInputRef.current?.click();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id || !token) return;
    setImgUploading(true);
    setFeedback(null);
    // Show local preview immediately
    setImgSrc(URL.createObjectURL(file));
    try {
      const result = await uploadTeacherImage(user.id, file);
      dispatch(updateUserProfile({ profileImg: result.imageUrl }));
      setFeedback({ type: "success", msg: "Profile image updated." });
    } catch (err: any) {
      setFeedback({ type: "danger", msg: err.message ?? "Image upload failed." });
    } finally {
      setImgUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !token) return;
    setSaving(true);
    setFeedback(null);
    try {
      await updateTeacher(user.id, { firstName: form.firstName, lastName: form.lastName, contact: form.contact, cnic: form.cnic });
      setFeedback({ type: "success", msg: "Profile updated successfully." });
    } catch (err: any) {
      setFeedback({ type: "danger", msg: err.message ?? "Failed to save changes." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="mb-3 border-bottom pb-3">
          <h4 className="fw-bold mb-0">Settings</h4>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="row">
              {/* ── Left nav ── */}
              <div className="col-lg-3">
                <div className="text-start">
                  <Link
                    href={all_routes.teacherOverview}
                    className="d-block w-100 btn btn-md border rounded fs-14 fw-medium text-dark text-start mb-1"
                  >
                    <i className="ti ti-layout-dashboard me-2 text-dark" /> My Overview
                  </Link>
                  <Link
                    href={all_routes.teacherProfile}
                    className="d-block w-100 btn btn-md border rounded fs-14 fw-medium text-primary text-start mb-1 active"
                  >
                    <i className="ti ti-user-cog me-2 text-primary" /> Profile Settings
                  </Link>
                </div>
              </div>

              {/* ── Form ── */}
              <div className="col-lg-9">
                <div className="border-1 border-start ps-4">
                  <h5 className="fw-bold pb-3 mb-4 border-1 border-bottom">Basic Information</h5>

                  {feedback && (
                    <div className={`alert alert-${feedback.type} alert-dismissible`} role="alert">
                      {feedback.msg}
                      <button type="button" className="btn-close" onClick={() => setFeedback(null)} />
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    {/* Profile image */}
                    <div className="row align-items-center mb-4 border-bottom pb-4">
                      <div className="col-lg-2">
                        <label className="form-label mb-0">
                          Profile Image
                        </label>
                      </div>
                      <div className="col-lg-10">
                        <div className="profile-container" style={{ position: "relative", display: "inline-block" }}>
                          <img
                            src={imgSrc}
                            alt="Profile"
                            style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "2px solid #e9ecef" }}
                            onError={() => setImgSrc("/assets/img/users/user-08.jpg")}
                          />
                          <div
                            className="overlay-btn"
                            onClick={handleImageClick}
                            style={{
                              position: "absolute", bottom: 0, right: 0,
                              background: "#0d6efd", borderRadius: "50%",
                              width: 26, height: 26, display: "flex",
                              alignItems: "center", justifyContent: "center",
                              cursor: "pointer",
                            }}
                            title="Upload photo"
                          >
                            {imgUploading
                              ? <span className="spinner-border spinner-border-sm text-white" style={{ width: 14, height: 14 }} />
                              : <i className="ti ti-photo fs-12 text-white" />
                            }
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={handleImageChange}
                          />
                        </div>
                        <p className="text-muted fs-12 mt-2 mb-0">Click the camera icon to upload a new photo.</p>
                      </div>
                    </div>

                    <div className="row border-bottom mb-4 pb-2">
                      <div className="col-lg-6 mb-3">
                        <div className="row align-items-center">
                          <div className="col-lg-4">
                            <label className="form-label mb-0">First Name <span className="text-danger">*</span></label>
                          </div>
                          <div className="col-lg-8">
                            <input type="text" name="firstName" className="form-control" value={form.firstName} onChange={handleChange} required />
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-6 mb-3">
                        <div className="row align-items-center">
                          <div className="col-lg-4">
                            <label className="form-label mb-0">Last Name <span className="text-danger">*</span></label>
                          </div>
                          <div className="col-lg-8">
                            <input type="text" name="lastName" className="form-control" value={form.lastName} onChange={handleChange} required />
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-6 mb-3">
                        <div className="row align-items-center">
                          <div className="col-lg-4">
                            <label className="form-label mb-0">Username</label>
                          </div>
                          <div className="col-lg-8">
                            <input type="text" className="form-control bg-light" value={user?.username ?? ""} readOnly />
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-6 mb-3">
                        <div className="row align-items-center">
                          <div className="col-lg-4">
                            <label className="form-label mb-0">Email</label>
                          </div>
                          <div className="col-lg-8">
                            <input type="email" className="form-control bg-light" value={form.email} readOnly />
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-6 mb-3">
                        <div className="row align-items-center">
                          <div className="col-lg-4">
                            <label className="form-label mb-0">Phone Number <span className="text-danger">*</span></label>
                          </div>
                          <div className="col-lg-8">
                            <PhoneCountryInput
                              value={form.contact}
                              onChange={(val) => setForm((prev) => ({ ...prev, contact: val }))}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="col-lg-6 mb-3">
                        <div className="row align-items-center">
                          <div className="col-lg-4">
                            <label className="form-label mb-0">CNIC <span className="text-danger">*</span></label>
                          </div>
                          <div className="col-lg-8">
                            <input type="text" name="cnic" className="form-control" value={form.cnic} onChange={handleChange} required placeholder="3520112345671" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex justify-content-end gap-2">
                      <button type="button" className="btn btn-light btn-md fs-13 fw-medium rounded" onClick={() => {
                        if (profile) setForm({ firstName: profile.firstName, lastName: profile.lastName, email: profile.email, contact: profile.contact, cnic: profile.cnic });
                        setFeedback(null);
                      }}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary btn-md fs-13 fw-medium rounded" disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherProfileSettings;
