"use client";

import { useRef, useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/core/redux/hooks";
import { updateUserProfile } from "@/core/redux/authSlice";
import { updateAdmin, uploadAdminImage, getAdminImageUrl } from "@/services/profileService";
import { resolveImageUrl } from "@/environment";

const ProfileSettingsComponent = () => {
  const dispatch = useAppDispatch();
  const { user, token } = useAppSelector((state) => state.auth);
  const [name, setName] = useState(user?.username ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; msg: string } | null>(null);

  // Image state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing profile image
  useEffect(() => {
    if (!user?.id || !token) return;
    fetch(getAdminImageUrl(String(user.id)), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.imageUrl) {
          setPreviewUrl(`${resolveImageUrl(data.imageUrl)}`);
        }
      })
      .catch(() => {});
  }, [user?.id, token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleImageUpload = async () => {
    if (!imageFile || !user?.id) return;
    setUploadingImg(true);
    setFeedback(null);
    try {
      const { imageUrl } = await uploadAdminImage(String(user.id), imageFile);
      setPreviewUrl(`${resolveImageUrl(imageUrl)}`);
      setImageFile(null);
      dispatch(updateUserProfile({ profileImg: imageUrl }));
      setFeedback({ type: "success", msg: "Profile image updated successfully." });
    } catch (err: any) {
      setFeedback({ type: "danger", msg: err.message ?? "Failed to upload image." });
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !token) return;
    setSaving(true);
    setFeedback(null);
    try {
      await updateAdmin(String(user.id), { name });
      setFeedback({ type: "success", msg: "Profile updated successfully." });
    } catch (err: any) {
      setFeedback({ type: "danger", msg: err.message ?? "Failed to save changes." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content" id="profilePage">
          <div className="mb-3 border-bottom pb-3">
            <h4 className="fw-bold mb-0">Settings</h4>
          </div>
          <div className="card">
            <div className="card-header border-bottom">
              <h5 className="fw-bold mb-0">Basic Information</h5>
            </div>
            <div className="card-body">
              {feedback && (
                <div className={`alert alert-${feedback.type} alert-dismissible mb-3`} role="alert">
                  {feedback.msg}
                  <button type="button" className="btn-close" onClick={() => setFeedback(null)} />
                </div>
              )}

              {/* Profile Image */}
              <div className="row align-items-center mb-4 pb-3 border-bottom">
                <div className="col-lg-2 col-sm-3 col-4">
                  <div
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "2px solid #dee2e6",
                      background: "#f8f9fa",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <i className="ti ti-user" style={{ fontSize: 40, color: "#adb5bd" }} />
                    )}
                  </div>
                </div>
                <div className="col-lg-10 col-sm-9 col-8">
                  <p className="mb-1 fw-semibold">Profile Photo</p>
                  <p className="text-muted small mb-2">
                    JPG, PNG or GIF. Max size 5 MB.
                  </p>
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {previewUrl ? "Change Photo" : "Upload Photo"}
                    </button>
                    {imageFile && (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={handleImageUpload}
                        disabled={uploadingImg}
                      >
                        {uploadingImg ? "Uploading..." : "Save Photo"}
                      </button>
                    )}
                    {previewUrl && !imageFile && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => {
                          setPreviewUrl(null);
                          setImageFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="d-none"
                    onChange={handleFileChange}
                  />
                </div>
              </div>

              {/* Name / Username / Role */}
              <form onSubmit={handleSubmit}>
                <div className="row border-bottom mb-3 pb-3">
                  <div className="col-lg-6">
                    <div className="row align-items-center mb-3">
                      <div className="col-lg-4">
                        <label className="form-label mb-0">
                          Display Name <span className="text-danger ms-1">*</span>
                        </label>
                      </div>
                      <div className="col-lg-8">
                        <input
                          type="text"
                          className="form-control"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          placeholder="Your display name"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="row align-items-center mb-3">
                      <div className="col-lg-4">
                        <label className="form-label mb-0">Username</label>
                      </div>
                      <div className="col-lg-8">
                        <input
                          type="text"
                          className="form-control bg-light"
                          value={user?.username ?? ""}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="row align-items-center mb-3">
                      <div className="col-lg-4">
                        <label className="form-label mb-0">Role</label>
                      </div>
                      <div className="col-lg-8">
                        <input
                          type="text"
                          className="form-control bg-light"
                          value={user?.role?.name ?? "ADMIN"}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-end">
                  <button
                    type="button"
                    className="btn btn-light me-3"
                    onClick={() => { setName(user?.username ?? ""); setFeedback(null); }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProfileSettingsComponent;
